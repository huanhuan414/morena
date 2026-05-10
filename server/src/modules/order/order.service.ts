// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { EarningService } from '../earning/earning.service'
import * as crypto from 'crypto'

@Injectable()
export class OrderService {
  constructor(private readonly earningService: EarningService) {}

  async createOrder(userId: string, orderData: Record<string, any>) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    console.log('[OrderService] 创建订单，ID:', id, '数据:', orderData)
    
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
      expected_quantity: orderData.avatar_count || orderData.avatarCount || 1,
      avatar_count: orderData.avatar_count || orderData.avatarCount || 1,
      quantity_per_avatar: orderData.quantity_per_avatar || orderData.quantityPerAvatar || 1,
      is_paid: 0,
    }
    
    const insertResult = await db.insert('orders', insertData)
    
    if (insertResult.error) {
      console.error('[OrderService] 订单插入失败:', insertResult.error)
      throw new Error('订单创建失败: ' + insertResult.error.message)
    }
    
    console.log('[OrderService] 订单创建成功，ID:', id, 'affectedRows:', insertResult.data?.affectedRows)
    return { id, status: 'pending_payment' }
  }

  // 转换订单数据中的日期对象
  private transformOrderData(order: any): any {
    if (!order) return order
    const result: any = { ...order }
    // 转换日期对象为 ISO 字符串
    if (result.created_at instanceof Date) {
      result.created_at = result.created_at.toISOString()
    }
    if (result.updated_at instanceof Date) {
      result.updated_at = result.updated_at.toISOString()
    }
    if (result.completed_at instanceof Date) {
      result.completed_at = result.completed_at.toISOString()
    }
    return result
  }

  async getOrder(orderId: string) {
    const db = getMySQLClient()
    const order = await db.queryOne('orders', { id: orderId }) as any
    
    if (!order) {
      return null
    }
    
    // 查询订单关联的分身请求
    const avatarRequests = await db.query('order_requests', { order_id: orderId }) as any[]
    
    // 如果有分身请求，关联查询分身详情
    if (avatarRequests.length > 0) {
      const avatarIds = avatarRequests.map((r: any) => r.avatar_id).filter(Boolean)
      if (avatarIds.length > 0) {
        const placeholders = avatarIds.map(() => '?').join(',')
        const avatars = await db.execute(
          `SELECT id, nickname, avatar_url, platforms, status, total_tasks, completed_tasks FROM avatars WHERE id IN (${placeholders})`,
          avatarIds
        ) as any[]
        
        // 关联分身信息和请求状态
        const avatarStats = avatarRequests.map((req: any) => {
          const avatar = avatars.find((a: any) => a.id === req.avatar_id)
          return {
            avatarId: req.avatar_id,
            requestId: req.id,
            nickname: avatar?.nickname || '未知分身',
            avatarUrl: avatar?.avatar_url || '',
            platforms: avatar?.platforms || [],
            status: req.status || 'pending',
            totalTasks: avatar?.total_tasks || 0,
            completedTasks: avatar?.completed_tasks || 0,
            submittedAt: req.created_at
          }
        })
        
        order.avatarStats = avatarStats
        order.summary_stats = {
          avatarStats,
          totalAvatars: avatarStats.length,
          pendingAvatars: avatarStats.filter((a: any) => a.status === 'pending').length,
          inProgressAvatars: avatarStats.filter((a: any) => a.status === 'in_progress').length,
          completedAvatars: avatarStats.filter((a: any) => a.status === 'completed').length
        }
      }
    }
    
    return this.transformOrderData(order)
  }

  async getOrders(userId: string, filters: Record<string, any> = {}) {
    const db = getMySQLClient()
    filters.user_id = userId
    const orders = await db.query('orders', filters) as any[]
    
    // 批量获取分身数量
    const orderIds = orders.map(o => o.id)
    let avatarCounts: Record<string, number> = {}
    if (orderIds.length > 0) {
      const placeholders = orderIds.map(() => '?').join(',')
      const counts = await db.execute(
        `SELECT order_id, COUNT(*) as count FROM order_requests WHERE order_id IN (${placeholders}) GROUP BY order_id`,
        orderIds
      ) as any[]
      avatarCounts = counts.reduce((acc, row) => {
        acc[row.order_id] = row.count
        return acc
      }, {} as Record<string, number>)
    }
    
    return orders.map(order => ({
      ...this.transformOrderData(order),
      dispatchedCount: avatarCounts[order.id] || 0
    }))
  }

  async updateOrderStatus(orderId: string, status: string) {
    const db = getMySQLClient()
    const order = await db.queryOne('orders', { id: orderId }) as any
    if (!order) {
      throw new Error('订单不存在')
    }
    
    await db.updateWhere('orders', { id: orderId }, {
      status,
      updated_at: new Date()
    })
    
    return { success: true }
  }

  async cancelOrder(orderId: string, userId: string) {
    const db = getMySQLClient()
    const order = await db.queryOne('orders', { id: orderId }) as any
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    if (order.user_id !== userId) {
      throw new Error('无权限取消此订单')
    }
    
    if (['completed', 'cancelled'].includes(order.status)) {
      throw new Error('当前状态不允许取消')
    }
    
    await db.updateWhere('orders', { id: orderId }, {
      status: 'cancelled',
      updated_at: new Date()
    })
    
    return { success: true }
  }
}
