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

  /**
   * 获取推荐分身列表（只推荐开启托管的分身）
   */
  async getRecommendedAvatars(orderId: string, limit: number = 0) {
    const db = getMySQLClient()
    
    // 查询开启托管的分身（trust_enabled = 1 且 status = active）
    let sql = 'SELECT * FROM avatars WHERE trust_enabled = 1 AND status = ? ORDER BY updated_at DESC'
    if (limit > 0) {
      sql += ` LIMIT ${parseInt(String(limit))}`
    }
    
    const result = await db.query(sql, ['active'])
    const avatars = Array.isArray(result) ? result : (result?.data || [])
    
    return avatars
  }

  /**
   * 订单分配（只分配给开启托管的分身）
   */
  async dispatchOrder(orderId: string) {
    const db = getMySQLClient()
    
    // 查询开启托管的分身
    const avatars = await this.getRecommendedAvatars(orderId, 1)
    
    if (avatars.length === 0) {
      return null
    }
    
    const avatar = avatars[0]
    
    // 创建分发请求
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: orderId,
      avatar_id: avatar.id,
      user_id: avatar.user_id,
      platform: 'auto',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { avatar_id: avatar.id, avatar_name: avatar.name }
  }

  async getExecutionProgress(orderId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { order_id: orderId }) as any[]
    return requests
  }

  async getDispatchStatus(orderId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { order_id: orderId }) as any[]
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === 'pending').length,
      confirmed: requests.filter(r => r.status === 'confirmed').length,
      rejected: requests.filter(r => r.status === 'rejected').length
    }
  }

  async dispatchToAvatar(orderId: string, avatarId: string) {
    const db = getMySQLClient()
    
    // 查询分身
    const avatars = await db.query('SELECT * FROM avatars WHERE id = ?', [avatarId]) as any[]
    if (avatars.length === 0) {
      throw new Error('分身不存在')
    }
    
    const avatar = avatars[0]
    
    // 创建分发请求
    const id = crypto.randomUUID()
    await db.insert('order_dispatch_requests', {
      id,
      order_id: orderId,
      avatar_id: avatarId,
      user_id: avatar.user_id,
      platform: 'manual',
      status: 'pending',
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { avatar_id: avatarId }
  }

  async getRequestById(requestId: string) {
    const db = getMySQLClient()
    const requests = await db.query('order_dispatch_requests', { id: requestId }) as any[]
    return requests[0] || null
  }

  async confirmDispatch(requestId: string, avatarId: string) {
    const db = getMySQLClient()
    await db.update('order_dispatch_requests', { status: 'confirmed' }, { id: requestId })
    return { success: true }
  }

  async rejectDispatch(requestId: string, avatarId: string) {
    const db = getMySQLClient()
    await db.update('order_dispatch_requests', { status: 'rejected' }, { id: requestId })
    return { success: true }
  }
}

import * as crypto from 'crypto'
