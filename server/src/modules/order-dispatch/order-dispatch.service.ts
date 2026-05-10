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

  /**
   * 一键分配订单给所有可用分身
   */
  async dispatchToAllAvatars(orderId: string) {
    const db = getMySQLClient()
    
    // 查询所有开启托管的分身
    const avatars = await db.query(
      'SELECT * FROM avatars WHERE trust_enabled = 1 AND status = ?', 
      ['active']
    ) as any[]
    
    if (avatars.length === 0) {
      return { count: 0, avatarIds: [] }
    }
    
    const avatarIds: string[] = []
    
    // 为每个分身创建分发请求
    for (const avatar of avatars) {
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
      avatarIds.push(avatar.id)
    }
    
    return { count: avatars.length, avatarIds }
  }

  /**
   * 发送短信通知给分身
   */
  async notifyAvatars(orderId: string, avatarIds: string[], customMessage?: string) {
    const db = getMySQLClient()
    
    // 查询订单信息
    const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]) as any[]
    const order = orders[0]
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    let notifiedCount = 0
    
    // 为每个分身创建通知
    for (const avatarId of avatarIds) {
      // 查询分身信息
      const avatars = await db.query('SELECT * FROM avatars WHERE id = ?', [avatarId]) as any[]
      const avatar = avatars[0]
      
      if (!avatar) continue
      
      // 生成通知内容
      const message = customMessage || `您有新的订单任务：${order.title || '内容创作'}，请及时查收并完成。`
      
      // 创建通知记录
      const id = crypto.randomUUID()
      await db.insert('avatar_notifications', {
        id,
        avatar_id: avatarId,
        order_id: orderId,
        type: 'order_assigned',
        title: '新订单分配',
        content: message,
        status: 'unread',
        created_at: new Date(),
        updated_at: new Date()
      })
      
      // 记录短信发送日志（模拟）
      console.log(`[SMS通知] 分身 ${avatar.name} (${avatar.phone || '无电话'}) - 订单: ${order.title}`)
      console.log(`[SMS内容] ${message}`)
      
      notifiedCount++
    }
    
    return { count: notifiedCount }
  }
}

import * as crypto from 'crypto'
