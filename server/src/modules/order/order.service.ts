// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import { NotificationService } from '../notification/notification.service'
import * as crypto from 'crypto'

@Injectable()
export class OrderService {
  constructor(
    private readonly earningService: EarningService,
    private readonly notificationService: NotificationService
  ) {}

  private safeParseJson<T>(value: any, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'object') return value as T
    if (typeof value === 'string') {
      try {
        return JSON.parse(value) as T
      } catch {
        return fallback
      }
    }
    return fallback
  }

  private normalizeDispatchStatus(status?: string): string {
    if (status === 'confirmed') {
      return 'accepted'
    }
    return status || 'pending'
  }

  private isAcceptedDispatchStatus(status?: string): boolean {
    return [
      'accepted',
      'generating',
      'preview',
      'publishing',
      'published',
      'feedback_submitted',
      'awaiting_acceptance',
      'completed'
    ].includes(this.normalizeDispatchStatus(status))
  }

  // 订单状态流转映射
  private statusTransitions: Record<string, string[]> = {
    'pending_payment': ['open', 'cancelled'],
    'open': ['pending_dispatch', 'cancelled'],
    'pending_dispatch': ['pending_acceptance', 'cancelled'],
    'pending_acceptance': ['in_progress', 'rejected', 'cancelled'],
    'in_progress': ['submitted', 'cancelled'],
    'submitted': ['awaiting_acceptance', 'revision_requested'],
    'awaiting_acceptance': ['completed', 'revision_requested'],
    'revision_requested': ['in_progress'],
    'completed': [],
    'cancelled': [],
    'rejected': []
  }

  private isValidTransition(fromStatus: string, toStatus: string): boolean {
    const allowedTransitions = this.statusTransitions[fromStatus] || []
    return allowedTransitions.includes(toStatus)
  }

  async createOrder(userId: string, orderData: Record<string, any>) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    console.log('[OrderService] 创建订单，ID:', id, '数据:', orderData)
    
    const avatarCount = orderData.avatar_count || orderData.avatarCount || orderData.requiredAvatars || 1
    
    // 将优先级字符串转换为整数
    const priorityMap: Record<string, number> = {
      'low': 1,
      'normal': 2,
      'high': 3
    }
    const priorityValue = priorityMap[orderData.priority] || priorityMap['normal']
    
    const insertData: Record<string, any> = {
      id,
      user_id: userId,
      title: orderData.title,
      description: orderData.description || '',
      content_type: orderData.content_type || orderData.contentType || 'text',
      platforms: JSON.stringify(orderData.platforms || []),
      requirements: JSON.stringify(orderData.requirements || {}),
      budget: orderData.total_price || orderData.budget || 0,
      status: 'pending_payment',
      expected_quantity: avatarCount,
      quantity_per_avatar: orderData.quantity_per_avatar || orderData.quantityPerAvatar || 1,
      is_paid: 0,
      target_audience: orderData.targetAudience || orderData.target_audience || '',
      priority: priorityValue
    }

    const fields = Object.keys(insertData).join(', ')
    const values = Object.values(insertData)
    const placeholders = values.map(() => '?').join(', ')

    await db.query(
      `INSERT INTO orders (${fields}) VALUES (${placeholders})`,
      values
    ).catch((err: any) => {
      console.error('[OrderService] INSERT 失败:', err)
      throw err
    })

    return { id, ...insertData, avatarCount }
  }

  async getOrderById(orderId: string) {
    const db = getMySQLClient()
    
    const orderRows = await db.query(
      `SELECT id, user_id, avatar_id, title, description, content_type, 
       platforms, requirements, budget, status, result, created_at, updated_at,
       completed_at, latitude, longitude, location_text, target_audience,
       expected_quantity, deadline, order_type, priority, assigned_to,
       avatar_count, quantity_per_avatar, is_paid
       FROM orders WHERE id = ?`,
      [orderId]
    )
    
    if (!orderRows || orderRows.length === 0) {
      return null
    }
    const order = orderRows[0]
    
    const avatarRows = await db.query(
      `SELECT odr.id, odr.avatar_id, odr.status, odr.platform, odr.created_at,
              a.name as nickname, a.avatar_url
       FROM order_dispatch_requests odr
       LEFT JOIN avatars a ON odr.avatar_id = a.id
       WHERE odr.order_id = ?
       ORDER BY odr.created_at DESC`,
      [orderId]
    )

    const processingRows = await db.query(
      `SELECT id, order_id, avatar_id, status, publish_feedback, publish_status, created_at, updated_at
       FROM content_generation_requests
       WHERE order_id = ?
       ORDER BY updated_at DESC, created_at DESC`,
      [orderId]
    ).catch(() => [])

    const latestProcessingMap = new Map<string, any>()
    for (const row of processingRows || []) {
      const avatarId = row.avatarId || row.avatar_id
      if (avatarId && !latestProcessingMap.has(avatarId)) {
        latestProcessingMap.set(avatarId, row)
      }
    }
    
    const avatarStats = (avatarRows || []).map((row: any) => {
      const avatarId = row.avatarId || row.avatar_id
      const processing = latestProcessingMap.get(avatarId)
      const normalizedStatus = this.normalizeDispatchStatus(processing?.status || row.status)

      return {
        id: row.id,
        requestId: processing?.id || row.id,
        avatarId,
        avatarName: row.nickname || '未知分身',
        nickname: row.nickname || '未知分身',
        avatarUrl: row.avatarUrl || row.avatar_url || '',
        platform: row.platform || 'unknown',
        status: normalizedStatus,
        publishFeedback: this.safeParseJson(processing?.publishFeedback || processing?.publish_feedback, {}),
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      }
    })

    const summaryStats = {
      totalAvatars: avatarStats.length,
      acceptedAvatars: avatarStats.filter((row: any) => this.isAcceptedDispatchStatus(row.status)).length,
      completedAvatars: avatarStats.filter((row: any) => row.status === 'completed').length,
      totalPosts: 0,
      totalPlatforms: 0,
      totalPublished: avatarStats.filter((row: any) => ['published', 'feedback_submitted', 'awaiting_acceptance', 'completed'].includes(row.status)).length,
      totalManual: 0,
      totalViews: 0,
      totalLikes: 0,
      totalComments: 0,
      totalShares: 0,
      avatarStats
    }
    
    const createdAt = order.created_at instanceof Date 
      ? order.created_at.toISOString() 
      : String(order.created_at)
    
    return {
      ...order,
      id: order.id,
      title: order.title,
      description: order.description,
      contentType: order.content_type,
      platforms: typeof order.platforms === 'string' 
        ? JSON.parse(order.platforms) 
        : (order.platforms || []),
      requirements: typeof order.requirements === 'string' 
        ? JSON.parse(order.requirements) 
        : (order.requirements || {}),
      budget: order.budget,
      status: order.status,
      avatarCount: order.avatarCount || order.avatar_count || 1,
      avatarStats,
      summary_stats: summaryStats,
      createdAt
    }
  }

  async getOrders(userId: string, filters: Record<string, any> = {}) {
    const db = getMySQLClient()
    
    let whereClause = 'WHERE user_id = ?'
    const params: any[] = [userId]
    
    if (filters.status) {
      whereClause += ' AND status = ?'
      params.push(filters.status)
    }
    
    const rows = await db.query(
      `SELECT id, title, description, content_type, platforms, requirements, 
              budget, status, expected_quantity, avatar_count, is_paid, created_at
       FROM orders ${whereClause} ORDER BY created_at DESC LIMIT 100`,
      params
    )
    
    const orderIds = (rows || []).map((row: any) => row.id)
    let dispatchCounts: Record<string, number> = {}
    
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(', ')
      const countRows = await db.query(
        `SELECT order_id, COUNT(*) as count FROM order_dispatch_requests WHERE order_id IN (${placeholders}) GROUP BY order_id`,
        orderIds
      )
      for (const row of countRows) {
        dispatchCounts[row.order_id] = row.count
      }
    }
    
    return (rows || []).map((row: any) => {
      let platforms = row.platforms
      if (typeof platforms === 'string') {
        try {
          platforms = JSON.parse(platforms)
        } catch {
          platforms = []
        }
      }
      
      let requirements = row.requirements
      if (typeof requirements === 'string') {
        try {
          requirements = JSON.parse(requirements)
        } catch {
          requirements = {}
        }
      }
      
      let avatarStats = row.avatar_stats
      if (typeof avatarStats === 'string') {
        try {
          avatarStats = JSON.parse(avatarStats)
        } catch {
          avatarStats = []
        }
      }
      
      let createdAt = ''
      if (row.created_at) {
        if (row.created_at instanceof Date) {
          createdAt = row.created_at.toISOString()
        } else if (typeof row.created_at === 'string' && row.created_at.length > 0) {
          try {
            const date = new Date(row.created_at)
            if (!Number.isNaN(date.getTime())) {
              createdAt = date.toISOString()
            }
          } catch {
            createdAt = row.created_at
          }
        }
      }
      if (createdAt === 'undefined' || createdAt === 'null' || createdAt === '') {
        createdAt = new Date().toISOString()
      }
      
      const dispatchedCount = dispatchCounts[row.id] || 0
      const needAvatarCount = row.expectedQuantity || row.avatarCount || 0
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        contentType: row.contentType,
        platforms,
        requirements,
        budget: row.budget,
        status: row.status,
        avatarCount: needAvatarCount,
        dispatchedCount,
        avatarStats: avatarStats || [],
        isPaid: row.isPaid,
        createdAt
      }
    })
  }

  async getOrderStats(userId: string) {
    const db = getMySQLClient()
    
    const rows = await db.query(
      `SELECT 
         COUNT(*) as total,
         SUM(CASE WHEN status = 'pending_payment' THEN 1 ELSE 0 END) as pendingPayment,
         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
         SUM(budget) as totalBudget
       FROM orders WHERE user_id = ?`,
      [userId]
    )
    
    if (!rows || rows.length === 0) {
      return { total: 0, pendingPayment: 0, inProgress: 0, completed: 0, totalBudget: 0 }
    }
    
    return rows[0]
  }

  async updateOrder(orderId: string, updateData: Record<string, any>) {
    const db = getMySQLClient()

    const fieldMap: Record<string, string> = {
      title: 'title',
      description: 'description',
      content_type: 'content_type',
      contentType: 'content_type',
      platforms: 'platforms',
      requirements: 'requirements',
      budget: 'budget',
      status: 'status',
      expected_quantity: 'expected_quantity',
      expectedQuantity: 'expected_quantity',
      avatar_count: 'avatar_count',
      avatarCount: 'avatar_count',
      quantity_per_avatar: 'quantity_per_avatar',
      quantityPerAvatar: 'quantity_per_avatar',
      avatar_id: 'avatar_id',
      avatarId: 'avatar_id',
      result: 'result',
      deadline: 'deadline',
      priority: 'priority',
      order_type: 'order_type',
      orderType: 'order_type',
      location_text: 'location_text',
      locationText: 'location_text',
      latitude: 'latitude',
      longitude: 'longitude',
      target_audience: 'target_audience',
      targetAudience: 'target_audience'
    }

    const normalized: Record<string, any> = {}
    for (const [key, value] of Object.entries(updateData || {})) {
      const dbField = fieldMap[key]
      if (!dbField) continue
      if (dbField === 'platforms') {
        normalized[dbField] = JSON.stringify(Array.isArray(value) ? value : this.safeParseJson<any[]>(value, []))
      } else if (dbField === 'requirements' || dbField === 'result') {
        normalized[dbField] = typeof value === 'string' ? value : JSON.stringify(value ?? {})
      } else {
        normalized[dbField] = value
      }
    }

    if (Object.keys(normalized).length > 0) {
      normalized.updated_at = new Date()
      const setClause = Object.keys(normalized).map((key) => `${key} = ?`).join(', ')
      const params = [...Object.values(normalized), orderId]
      await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)
    }

    return this.getOrderById(orderId)
  }

  async getOpenOrders(page: number = 1, pageSize: number = 20) {
    const db = getMySQLClient()
    const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
    const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.min(Math.floor(pageSize), 100) : 20
    const offset = (safePage - 1) * safePageSize

    const whereClause = `
      WHERE (
        status IN ('open', 'pending_dispatch', 'pending_acceptance')
        OR (status = 'pending_payment' AND IFNULL(is_paid, 0) = 1)
      )
    `

    const rows = await db.query(
      `SELECT id, user_id, avatar_id, title, description, content_type, platforms, requirements,
              budget, status, expected_quantity, avatar_count, quantity_per_avatar, is_paid,
              created_at, updated_at
       FROM orders
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT ${safePageSize} OFFSET ${offset}`
    )

    const totalRows = await db.query(
      `SELECT COUNT(*) as total FROM orders ${whereClause}`
    )
    const total = Number(totalRows?.[0]?.total || 0)

    const items = (rows || []).map((row: any) => ({
      id: row.id,
      userId: row.userId || row.user_id,
      avatarId: row.avatarId || row.avatar_id,
      title: row.title,
      description: row.description || '',
      contentType: row.contentType || row.content_type || 'text',
      platforms: this.safeParseJson<any[]>(row.platforms, []),
      requirements: this.safeParseJson<Record<string, any>>(row.requirements, {}),
      budget: Number(row.budget || 0),
      status: row.status,
      avatarCount: row.expectedQuantity || row.avatarCount || row.expected_quantity || row.avatar_count || 1,
      quantityPerAvatar: row.quantityPerAvatar || row.quantity_per_avatar || 1,
      isPaid: row.isPaid ?? row.is_paid ?? 0,
      createdAt: row.createdAt || row.created_at || new Date().toISOString(),
      updatedAt: row.updatedAt || row.updated_at || null
    }))

    return {
      page: safePage,
      pageSize: safePageSize,
      total,
      items
    }
  }

  async getOrderFeedback(orderId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT id, order_id, avatar_id, result, created_at, updated_at
       FROM order_results
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [orderId]
    )

    const row = rows?.[0]
    if (!row) return null

    return {
      id: row.id,
      orderId: row.orderId || row.order_id,
      avatarId: row.avatarId || row.avatar_id,
      result: this.safeParseJson<Record<string, any>>(row.result, {}),
      createdAt: row.createdAt || row.created_at,
      updatedAt: row.updatedAt || row.updated_at
    }
  }

  async getOrderRating(orderId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT
         AVG(CASE WHEN customer_rating IS NOT NULL THEN customer_rating END) as average_rating,
         COUNT(CASE WHEN customer_rating IS NOT NULL THEN 1 END) as rating_count
       FROM order_results
       WHERE order_id = ?`,
      [orderId]
    )

    const data = rows?.[0] || {}
    return {
      averageRating: Number(data.averageRating || data.average_rating || 0),
      ratingCount: Number(data.ratingCount || data.rating_count || 0)
    }
  }

  async updateOrderStatus(orderId: string, status: string, avatarId?: string) {
    const db = getMySQLClient()
    
    const currentOrder = await this.getOrderById(orderId)
    if (!currentOrder) {
      throw new Error('订单不存在')
    }

    const currentStatus = currentOrder.status
    if (!this.isValidTransition(currentStatus, status)) {
      throw new Error(`无法从状态 "${currentStatus}" 转换到 "${status}"`)
    }

    const payload: Record<string, any> = {
      status,
      updated_at: new Date()
    }

    if (avatarId) {
      payload.avatar_id = avatarId
    }

    if (status === 'completed') {
      payload.completed_at = new Date()
    }

    const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
    const params = [...Object.values(payload), orderId]
    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)

    await this.notifyStatusChange(orderId, status)

    if (status === 'completed') {
      await this.triggerSettlement(orderId)
    }

    return this.getOrderById(orderId)
  }

  async acceptOrder(orderId: string, avatarId?: string) {
    const db = getMySQLClient()
    const orderRows = await db.query(
      `SELECT id, status, is_paid FROM orders WHERE id = ? LIMIT 1`,
      [orderId]
    )
    const order = orderRows?.[0]
    if (!order) {
      throw new Error('订单不存在')
    }

    const isPaid = Number(order.isPaid ?? order.is_paid ?? 0)
    if (order.status === 'pending_payment' && isPaid !== 1) {
      throw new Error('订单未支付，暂不可接单')
    }

    return this.updateOrderStatus(orderId, 'in_progress', avatarId)
  }

  async submitOrderResult(orderId: string, result: Record<string, any>) {
    const db = getMySQLClient()
    const payload = {
      result: JSON.stringify(result || {}),
      status: 'submitted',
      updated_at: new Date()
    }
    const setClause = Object.keys(payload).map((key) => `${key} = ?`).join(', ')
    const params = [...Object.values(payload), orderId]
    await db.query(`UPDATE orders SET ${setClause} WHERE id = ?`, params)
    return this.getOrderById(orderId)
  }

  async deleteOrder(orderId: string) {
    const db = getMySQLClient()
    await db.query('DELETE FROM order_dispatch_requests WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM content_generation_requests WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM order_results WHERE order_id = ?', [orderId])
    await db.query('DELETE FROM orders WHERE id = ?', [orderId])
  }

  async handlePaymentSuccess(orderId: string, transactionId: string) {
    const db = getMySQLClient()
    
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.isPaid === 1) {
      throw new Error('订单已支付')
    }

    await db.query(
      'UPDATE orders SET is_paid = 1, status = ?, updated_at = ? WHERE id = ?',
      ['open', new Date(), orderId]
    )

    await this.notificationService.createNotification({
      user_id: order.user_id,
      type: 'order_paid',
      title: '订单支付成功',
      content: `订单"${order.title}"支付成功，正在分配分身...`,
      metadata: { orderId, transactionId }
    })

    return this.getOrderById(orderId)
  }

  async handlePaymentFailure(orderId: string, reason: string) {
    const order = await this.getOrderById(orderId)
    if (!order) return

    await this.notificationService.createNotification({
      user_id: order.user_id,
      type: 'order_payment_failed',
      title: '订单支付失败',
      content: `订单"${order.title}"支付失败: ${reason}`,
      metadata: { orderId }
    })
  }

  private async notifyStatusChange(orderId: string, status: string) {
    const order = await this.getOrderById(orderId)
    if (!order) return

    const statusMessages: Record<string, string> = {
      'open': '订单已打开，等待派单',
      'pending_dispatch': '订单正在分配中',
      'pending_acceptance': '订单已分配，等待分身确认',
      'in_progress': '订单开始处理',
      'submitted': '订单结果已提交',
      'awaiting_acceptance': '等待验收',
      'completed': '订单已完成',
      'cancelled': '订单已取消',
      'rejected': '订单被拒绝',
      'revision_requested': '需要修改'
    }

    const message = statusMessages[status] || `订单状态变更为: ${status}`

    await this.notificationService.createNotification({
      user_id: order.user_id,
      type: `order_${status}`,
      title: '订单状态变更',
      content: message,
      metadata: { orderId, status }
    })
  }

  private async triggerSettlement(orderId: string) {
    const order = await this.getOrderById(orderId)
    if (!order || order.status !== 'completed') return

    const db = getMySQLClient()
    
    const dispatchRequests = await db.query(
      'SELECT avatar_id, user_id FROM order_dispatch_requests WHERE order_id = ? AND status = ?',
      [orderId, 'accepted']
    )

    const totalAmount = Number(order.budget || 0)
    const participantCount = dispatchRequests.length || 1
    const amountPerAvatar = totalAmount / participantCount

    const participants = dispatchRequests.map((request: any) => ({
      user_id: request.user_id || request.userId,
      avatar_id: request.avatar_id || request.avatarId,
      amount: amountPerAvatar
    }))

    await this.earningService.createOrderEarnings(orderId, participants)
    
    await this.earningService.settleOrderEarnings(orderId)

    console.log(`[OrderService] 订单 ${orderId} 结算完成，共 ${participantCount} 个参与者，每人 ${amountPerAvatar.toFixed(2)} 元`)
  }

  async submitRating(orderId: string, rating: number, comment?: string) {
    const db = getMySQLClient()
    
    const order = await this.getOrderById(orderId)
    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.status !== 'completed') {
      throw new Error('只有已完成的订单才能评价')
    }

    const id = crypto.randomUUID()
    await db.query(
      `INSERT INTO order_results (id, order_id, avatar_id, user_id, result, customer_rating, customer_comment, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        orderId,
        order.avatar_id,
        order.user_id,
        JSON.stringify({ rating, comment }),
        rating,
        comment || '',
        new Date(),
        new Date()
      ]
    )

    return { success: true, message: '评价成功' }
  }
}