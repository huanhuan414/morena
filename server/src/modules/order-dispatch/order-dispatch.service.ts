// @ts-nocheck
import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { SmsService } from '../sms/sms.service'
import { NotificationService } from '../notification/notification.service'

@Injectable()
export class OrderDispatchService {
  constructor(
    @Inject(forwardRef(() => SmsService)) private readonly smsService: SmsService,
    @Inject(forwardRef(() => NotificationService)) private readonly notificationService: NotificationService
  ) {}

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
    
    // 查询开启托管的分身（is_hosted = 1 且 status = active）
    let sql = 'SELECT * FROM avatars WHERE is_hosted = 1 AND status = ? ORDER BY updated_at DESC'
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
    
    // 查询订单信息
    const orders = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]) as any[]
    const order = orders[0]
    
    if (!order) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }
    
    // 获取订单需要的分身数量
    const requiredCount = order.expectedQuantity || order.expected_quantity || order.avatarCount || order.avatar_count || 1
    
    // 查询所有开启托管的分身，并关联用户表获取手机号
    // 注意：is_hosted 可能是字符串 'true'/'false' 或数字 1/0
    const allAvatars = await db.query(`
      SELECT a.*, u.phone AS user_phone 
      FROM avatars a 
      LEFT JOIN users u ON a.user_id = u.id 
      WHERE (a.is_hosted = 1 OR a.is_hosted = 'true') AND a.status = ?`, 
      ['active']
    ) as any[]
    
    // 只取订单需要的数量
    const avatars = allAvatars.slice(0, requiredCount)
    
    if (avatars.length === 0) {
      return { count: 0, avatarIds: [], smsSentCount: 0 }
    }
    
    const avatarIds: string[] = []
    let smsSentCount = 0
    
    // 为每个分身创建分发请求并发送短信
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
      
      // 发送真实短信通知 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone || avatar.user_phone
      console.log('[dispatchToAllAvatars] 分身手机号检查:', avatar.name, avatar.user_phone, avatar.phone, userPhone)
      if (userPhone) {
        const smsContent = `${order?.title || '内容创作'}`
        
        try {
          const smsResult = await this.smsService.sendSms(
            userPhone,
            'SMS_505555078',
            { name: avatar.name }
          )
          
          if (smsResult) {
            smsSentCount++
            console.log(`[SMS] 成功发送给分身 ${avatar.name} (用户手机: ${userPhone})`)
          }
        } catch (err) {
          console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
        }
        
        // 创建通知记录
        const notifId = crypto.randomUUID()
        await db.insert('avatar_notifications', {
          id: notifId,
          avatar_id: avatar.id,
          order_id: orderId,
          type: 'order_assigned',
          title: '新订单分配',
          content: smsContent,
          status: 'unread',
          created_at: new Date(),
          updated_at: new Date()
        })
      }
    }
    
    // 为用户创建通知（记录分配成功）
    if (avatars.length > 0) {
      try {
        await this.notificationService.createNotification({
          user_id: order.user_id,
          type: 'order_dispatched',
          title: '订单已分配',
          content: `已将订单"${order.title || '内容创作'}"分配给 ${avatars.length} 个分身，已发送短信通知。`,
          metadata: {
            orderId,
            avatarIds,
            count: avatars.length
          }
        })
      } catch (err) {
        console.error('[dispatchToAllAvatars] 创建用户通知失败:', err)
      }
    }
    
    return { count: avatars.length, avatarIds, smsSentCount }
  }

  /**
   * 分身接受订单
   */
  async acceptOrder(avatarId: string, orderId: string) {
    const db = getMySQLClient()
    
    // 查询分发请求
    const requests = await db.query(`
      SELECT r.*, o.title as order_title, o.user_id as owner_user_id 
      FROM order_dispatch_requests r 
      LEFT JOIN orders o ON r.order_id = o.id 
      WHERE r.avatar_id = ? AND r.order_id = ? AND r.status = 'pending'`, 
      [avatarId, orderId]
    ) as any[]
    
    const request = requests?.[0]
    if (!request) {
      throw new Error('订单不存在或已处理')
    }
    
    // 更新状态为 accepted
    await db.updateWhere('order_dispatch_requests', { id: request.id }, {
      status: 'accepted',
      updated_at: new Date()
    })
    
    // 为订单所有者创建通知（分身接受了订单）
    try {
      await this.notificationService.createNotification({
        user_id: request.owner_user_id,
        type: 'avatar_accepted_order',
        title: '分身已接受订单',
        content: `分身"${request.avatar_name || '未知'}"已接受订单"${request.order_title || '内容创作'}"`,
        metadata: {
          avatarId,
          orderId,
          dispatchRequestId: request.id
        }
      })
    } catch (err) {
      console.error('[acceptOrder] 创建通知失败:', err)
    }
    
    return { success: true }
  }

  /**
   * 发送短信通知给指定分身
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
    let smsSentCount = 0
    
    // 为每个分身创建通知并发送短信
    for (const avatarId of avatarIds) {
      // 查询分身信息，并关联用户表获取手机号
      const avatars = await db.query(`
        SELECT a.*, u.phone AS user_phone 
        FROM avatars a 
        LEFT JOIN users u ON a.user_id = u.id 
        WHERE a.id = ?`, [avatarId]) as any[]
      const avatar = avatars[0]
      
      if (!avatar) continue
      
      // 生成通知内容
      const message = customMessage || `您有新的订单任务：${order.title || '内容创作'}，请及时查收并完成。`
      const smsContent = `【莫瑞拉】${message}`
      
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
      
      // 发送真实短信 - 使用分身所属账号的手机号
      const userPhone = avatar.userPhone || avatar.phone || avatar.user_phone
      console.log('[dispatchToAllAvatars] 分身手机号检查:', avatar.name, avatar.user_phone, avatar.phone, userPhone)
      if (userPhone) {
        try {
          const smsResult = await this.smsService.sendSms(
            userPhone,
            'SMS_505555078',
            { name: avatar.name }
          )
          
          if (smsResult) {
            smsSentCount++
            console.log(`[SMS] 通知短信发送给 ${avatar.name} (用户手机: ${userPhone}) 成功`)
          }
        } catch (err) {
          console.error(`[SMS] 发送给 ${avatar.name} 失败:`, err)
        }
      } else {
        console.log(`[SMS] 分身 ${avatar.name} 的账号未绑定手机号，跳过短信发送`)
      }
      
      notifiedCount++
    }
    
    return { count: notifiedCount, smsSentCount }
  }
}
