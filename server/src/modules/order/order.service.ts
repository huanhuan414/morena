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

    const fields = Object.keys(insertData).join(', ')
    const values = Object.values(insertData)
    const placeholders = values.map(() => '?').join(', ')

    await db.query(
      `INSERT INTO orders (${fields}) VALUES (${placeholders})`,
      values
    )

    return { id, ...insertData }
  }

  async getOrderById(orderId: string) {
    const db = getMySQLClient()
    
    // 查询订单基本信息
    const orderRows = await db.query(
      'SELECT * FROM orders WHERE id = ?',
      [orderId]
    )
    
    if (!orderRows || orderRows.length === 0) {
      return null
    }
    
    const order = orderRows[0]
    
    // 查询分身分发列表
    const avatarRows = await db.query(
      `SELECT odr.id, odr.avatar_id, odr.status, odr.created_at,
              a.nickname, a.avatar_url, a.platforms
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
      avatarCount: order.avatar_count || order.expected_quantity || 0,
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
              budget, status, avatar_count, is_paid, created_at
       FROM orders ${whereClause} ORDER BY created_at DESC LIMIT 100`,
      params
    )
    
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
      
      // 处理日期
      const createdAt = row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at)
      
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        contentType: row.content_type,
        platforms,
        requirements,
        budget: row.budget,
        status: row.status,
        avatarCount: row.avatar_count || 0,
        avatarStats: avatarStats || [],
        isPaid: row.is_paid === 1,
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
