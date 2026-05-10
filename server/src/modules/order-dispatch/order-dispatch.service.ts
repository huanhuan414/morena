// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class OrderDispatchService {
  async createDispatchRequest(data: {
    order_id: string
    avatar_id: string
    user_id: string
    platform: string
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      user_id: data.user_id,
      platform: data.platform,
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getDispatchRequests(orderId: string) {
    const db = getMySQLClient()
    return await db.query('order_dispatch_requests', { order_id: orderId }) as any
  }

  async updateDispatchStatus(dispatchId: string, status: string) {
    const db = getMySQLClient()
    
    await db.updateWhere('order_dispatch_requests', { id: dispatchId }, {
      status,
      updated_at: new Date()
    })
    
    return { success: true }
  }

  async getUserPendingRequests(userId: string) {
    const db = getMySQLClient()
    // 直接使用SQL查询，避免蛇形转换问题
    return await db.query('SELECT * FROM order_dispatch_requests WHERE user_id = ? AND status = ?', [userId, 'pending']) as any
  }
}

import * as crypto from 'crypto'
