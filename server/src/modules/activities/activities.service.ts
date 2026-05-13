import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

export interface Activity {
  id: string
  type: 'order' | 'content' | 'avatar' | 'chat' | 'earning'
  title: string
  description: string
  timestamp: string
  avatar?: string
  amount?: string
  platform?: string
  status?: string
}

@Injectable()
export class ActivitiesService {
  async getRecentActivities(userId: string, limit: number = 10): Promise<Activity[]> {
    const activities: Activity[] = []

    // 1. 最近订单动态
    try {
      const db = getMySQLClient()
      const orders = await db.query(
        `SELECT id, title, status, budget, created_at, updated_at FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
        [userId]
      )
      for (const order of orders) {
        const statusMap: Record<string, string> = {
          'submitted': '已提交',
          'pending_payment': '待支付',
          'awaiting_acceptance': '待接单',
          'in_progress': '进行中',
          'completed': '已完成',
          'cancelled': '已取消',
        }
        activities.push({
          id: `order-${order.id}`,
          type: 'order',
          title: order.title || '新订单',
          description: `订单状态：${statusMap[order.status] || order.status}`,
          timestamp: order.updatedAt || order.createdAt,
          amount: order.budget ? `¥${Number(order.budget).toFixed(2)}` : undefined,
          status: order.status,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询订单失败:', err.message)
    }

    // 2. 最近内容生成动态
    try {
      const db = getMySQLClient()
      const contents = await db.query(
        `SELECT cg.id, cg.order_id, cg.status, cg.created_at, o.title as order_title
         FROM content_generation cg
         LEFT JOIN orders o ON cg.order_id = o.id
         WHERE o.user_id = ?
         ORDER BY cg.created_at DESC LIMIT 5`,
        [userId]
      )
      for (const content of contents) {
        const statusMap: Record<string, string> = {
          'pending': '待生成',
          'generating': '生成中',
          'generated': '已生成',
          'published': '已发布',
          'feedback_submitted': '待验收',
          'completed': '已完成',
        }
        activities.push({
          id: `content-${content.id}`,
          type: 'content',
          title: content.orderTitle || '内容生成',
          description: `内容${statusMap[content.status] || content.status}`,
          timestamp: content.createdAt,
          status: content.status,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询内容生成失败:', err.message)
    }

    // 3. 最近分身动态
    try {
      const db = getMySQLClient()
      const avatars = await db.query(
        `SELECT id, name, created_at, updated_at FROM avatars WHERE user_id = ? ORDER BY updated_at DESC LIMIT 3`,
        [userId]
      )
      for (const avatar of avatars) {
        const isNew = (new Date(avatar.updatedAt).getTime() - new Date(avatar.createdAt).getTime()) < 60000
        activities.push({
          id: `avatar-${avatar.id}`,
          type: 'avatar',
          title: avatar.name || '分身',
          description: isNew ? '新分身创建成功' : '分身状态更新',
          timestamp: avatar.updatedAt || avatar.createdAt,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询分身失败:', err.message)
    }

    // 4. 最近接单动态（分派请求）
    try {
      const db = getMySQLClient()
      const dispatches = await db.query(
        `SELECT od.id, od.order_id, od.avatar_id, od.status, od.created_at, o.title as order_title, a.name as avatar_name
         FROM order_dispatch_requests od
         LEFT JOIN orders o ON od.order_id = o.id
         LEFT JOIN avatars a ON od.avatar_id = a.id
         WHERE o.user_id = ? OR a.user_id = ?
         ORDER BY od.created_at DESC LIMIT 5`,
        [userId, userId]
      )
      for (const dispatch of dispatches) {
        const statusMap: Record<string, string> = {
          'pending': '待接单',
          'accepted': '已接单',
          'rejected': '已拒绝',
          'feedback_submitted': '待验收',
          'completed': '已完成',
        }
        activities.push({
          id: `dispatch-${dispatch.id}`,
          type: 'order',
          title: dispatch.orderTitle || '订单分派',
          description: `分身「${dispatch.avatarName || '未知'}」${statusMap[dispatch.status] || dispatch.status}`,
          timestamp: dispatch.createdAt,
          status: dispatch.status,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询分派记录失败:', err.message)
    }

    // 5. 最近收益动态
    try {
      const db = getMySQLClient()
      const earnings = await db.query(
        `SELECT id, amount, source, order_id, created_at FROM earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 5`,
        [userId]
      )
      for (const earning of earnings) {
        activities.push({
          id: `earning-${earning.id}`,
          type: 'earning',
          title: '收益到账',
          description: `${earning.source || '订单收益'}`,
          timestamp: earning.createdAt,
          amount: earning.amount ? `+¥${Number(earning.amount).toFixed(2)}` : undefined,
        })
      }
    } catch (err) {
      console.error('[Activities] 查询收益失败:', err.message)
    }

    // 按时间倒序排列
    activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    return activities.slice(0, limit)
  }
}
