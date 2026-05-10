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
    
    // 数据库表使用 expected_quantity 字段
    const avatarCount = orderData.avatar_count || orderData.avatarCount || orderData.requiredAvatars || 1
    
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
      expected_quantity: avatarCount, // 使用 expected_quantity 字段
      quantity_per_avatar: orderData.quantity_per_avatar || orderData.quantityPerAvatar || 1,
      is_paid: 0,
    }

    const fields = Object.keys(insertData).join(', ')
    const values = Object.values(insertData)
    const placeholders = values.map(() => '?').join(', ')

    // INSERT 成功即返回
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
    
    // 查询订单基本信息，显式选择字段避免驼峰转换问题
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
    console.log('[OrderService] getOrderDetail order keys:', Object.keys(order))
    console.log('[OrderService] avatar_count value:', order['avatar_count'], 'avatarCount:', order['avatarCount'])
    
    // 查询分身分发列表
    const avatarRows = await db.query(
      `SELECT odr.id, odr.avatar_id, odr.status, odr.created_at,
              a.name as nickname, a.avatar_url
       FROM order_requests odr
       LEFT JOIN avatars a ON odr.avatar_id = a.id
       WHERE odr.order_id = ?
       ORDER BY odr.created_at DESC`,
      [orderId]
    )
    
    // 转换分身数据格式
    const avatarStats = (avatarRows || []).map((row: any) => {
      let platforms = row.platforms
      if (typeof platforms === 'string') {
        try {
          platforms = JSON.parse(platforms)
        } catch {
          platforms = []
        }
      }
      return {
        id: row.id,
        avatarId: row.avatar_id,
        nickname: row.nickname || '未知分身',
        avatarUrl: row.avatar_url || '',
        platform: Array.isArray(platforms) ? platforms[0] || 'unknown' : 'unknown',
        status: row.status || 'pending',
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
      }
    })
    
    // 转换日期格式
    const createdAt = order.created_at instanceof Date 
      ? order.created_at.toISOString() 
      : String(order.created_at)
    
    console.log('[OrderService] getOrderDetail avatar_count:', order.avatar_count, 'expected_quantity:', order.expected_quantity)
    
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
    
    // 获取每个订单的分发请求数量
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
      // 处理 platforms 字段
      let platforms = row.platforms
      if (typeof platforms === 'string') {
        try {
          platforms = JSON.parse(platforms)
        } catch {
          platforms = []
        }
      }
      
      // 处理 requirements 字段
      let requirements = row.requirements
      if (typeof requirements === 'string') {
        try {
          requirements = JSON.parse(requirements)
        } catch {
          requirements = {}
        }
      }
      
      // 处理 avatar_stats 字段
      let avatarStats = row.avatar_stats
      if (typeof avatarStats === 'string') {
        try {
          avatarStats = JSON.parse(avatarStats)
        } catch {
          avatarStats = []
        }
      }
      
      // 处理日期 - 修复 created_at 为 undefined/null 时返回 "undefined" 字符串的问题
      let createdAt = ''
      if (row.created_at) {
        if (row.created_at instanceof Date) {
          createdAt = row.created_at.toISOString()
        } else if (typeof row.created_at === 'string' && row.created_at.length > 0) {
          // 尝试解析数据库返回的日期字符串
          try {
            const date = new Date(row.created_at)
            if (!Number.isNaN(date.getTime())) {
              createdAt = date.toISOString()
            }
          } catch {
            createdAt = row.created_at // 如果解析失败，返回原始字符串
          }
        }
      }
      // 如果 createdAt 是 "undefined" 或 "null" 字符串，设为空
      if (createdAt === 'undefined' || createdAt === 'null' || createdAt === '') {
        createdAt = new Date().toISOString() // 使用当前时间作为默认值
      }
      
      // 获取实际分配的分身数量
      const dispatchedCount = dispatchCounts[row.id] || 0
      // MySQL client 返回驼峰格式的字段名
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
        dispatchedCount, // 实际已分配的分身数量
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
}
