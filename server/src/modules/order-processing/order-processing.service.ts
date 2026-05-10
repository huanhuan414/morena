// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class OrderProcessingService {
  async createProcessingOrder(data: {
    order_id: string
    avatar_id: string
    user_id: string
    config?: Record<string, any>
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('order_processing', {
      id,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      user_id: data.user_id,
      status: 'processing',
      config: JSON.stringify(data.config || {}),
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getProcessingOrder(orderId: string) {
    const db = getMySQLClient()
    return await db.queryOne('order_processing', { order_id: orderId }) as any
  }

  async updateProcessingStatus(processingId: string, status: string, result?: Record<string, any>) {
    const db = getMySQLClient()
    
    const updateData: any = {
      status,
      updated_at: new Date()
    }
    
    if (result) {
      updateData.result = JSON.stringify(result)
    }
    
    await db.updateWhere('order_processing', { id: processingId }, updateData)
    
    return { success: true }
  }

  async getProcessingStatus(processingId: string) {
    const db = getMySQLClient()
    const processing = await db.queryOne('order_processing', { id: processingId }) as any
    
    if (!processing) {
      return null
    }
    
    // 映射状态
    let statusName = 'generating'
    let statusMessage = '生成中'
    
    if (processing.status === 'queued') {
      statusName = 'queuing'
      statusMessage = '排队中'
    } else if (processing.status === 'accepted') {
      statusName = 'accepted'
      statusMessage = '已接受'
    } else if (processing.status === 'generating') {
      statusName = 'generating'
      statusMessage = '生成中'
    } else if (processing.status === 'completed') {
      statusName = 'completed'
      statusMessage = '已完成'
    } else if (processing.status === 'failed') {
      statusName = 'failed'
      statusMessage = '生成失败'
    }
    
    return {
      requestId: processing.id,
      id: processing.id,
      status: statusName,
      statusName,
      statusMessage,
      result: processing.result ? JSON.parse(processing.result) : null,
      progress: processing.status === 'completed' ? 100 : processing.status === 'generating' ? 50 : 10
    }
  }

  async getProcessingOrders(userId: string) {
    const db = getMySQLClient()
    return await db.query('order_processing', { user_id: userId }) as any
  }
}

import * as crypto from 'crypto'
