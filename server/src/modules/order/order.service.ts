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
    await db.insert('orders', {
      id,
      user_id: userId,
      title: orderData.title,
      description: orderData.description || '',
      content_type: orderData.content_type || 'text',
      platforms: JSON.stringify(orderData.platforms || []),
      requirements: JSON.stringify(orderData.requirements || {}),
      budget: orderData.budget || 0,
      is_paid: orderData.is_paid !== false,
      status: 'pending_payment',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id, status: 'pending_payment' }
  }

  async getOrder(orderId: string) {
    const db = getMySQLClient()
    return await db.queryOne('orders', { id: orderId }) as any
  }

  async getOrders(userId: string, filters: Record<string, any> = {}) {
    const db = getMySQLClient()
    filters.user_id = userId
    return await db.query('orders', filters) as any
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
