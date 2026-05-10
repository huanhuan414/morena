// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getCache } from '../../common/shared-cache'

// 内存缓存，用于数据库不可用时
const memoryCache = new Map<string, any>()

@Injectable()
export class OrderProcessingService {
  // 判断数据库是否可用的标志
  private dbAvailable = true
  
  async createProcessingOrder(data: {
    order_id: string
    avatar_id: string
    user_id: string
    config?: Record<string, any>
  }) {
    const id = crypto.randomUUID()
    
    // 尝试使用数据库，失败则使用内存缓存
    try {
      const db = getMySQLClient()
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
    } catch (error) {
      this.dbAvailable = false
      // 使用内存缓存
      memoryCache.set(id, {
        id,
        order_id: data.order_id,
        avatar_id: data.avatar_id,
        user_id: data.user_id,
        status: 'processing',
        result: null,
        config: JSON.stringify(data.config || {}),
        created_at: new Date(),
        updated_at: new Date()
      })
    }
    
    return { id }
  }

  async getProcessingOrder(orderId: string) {
    try {
      const db = getMySQLClient()
      return await db.queryOne('order_processing', { order_id: orderId }) as any
    } catch (error) {
      // 从内存缓存获取
      for (const item of memoryCache.values()) {
        if (item.order_id === orderId) return item
      }
      return null
    }
  }

  async updateProcessingStatus(processingId: string, status: string, result?: Record<string, any>) {
    const updateData: any = {
      status,
      updated_at: new Date()
    }
    
    if (result) {
      updateData.result = JSON.stringify(result)
    }
    
    try {
      const db = getMySQLClient()
      await db.updateWhere('order_processing', { id: processingId }, updateData)
    } catch (error) {
      // 更新内存缓存
      if (memoryCache.has(processingId)) {
        memoryCache.set(processingId, {
          ...memoryCache.get(processingId),
          ...updateData
        })
      }
    }
    
    return { success: true }
  }

  async getProcessingStatus(processingId: string) {
    let processing: any = null
    
    // 尝试从数据库获取
    try {
      const db = getMySQLClient()
      processing = await db.queryOne('order_processing', { id: processingId }) as any
    } catch (error) {
      this.dbAvailable = false
      // 从内存缓存获取
      processing = memoryCache.get(processingId)
    }
    
    // 如果数据库和内存缓存都没有，检查共享缓存（content-generation 生成的数据）
    if (!processing && processingId.startsWith('req_')) {
      const cachedData = getCache(processingId)
      if (cachedData) {
        // 直接返回缓存的生成结果
        return {
          orderId: cachedData.order_id || processingId,
          orderTitle: cachedData.orderTitle || '商单内容',
          status: cachedData.status === 'completed' ? 'completed' : 'generating',
          generatedContent: {
            content: cachedData.content || '',
            images: cachedData.images || [],
            videos: cachedData.videos || [],
            platforms: [cachedData.platform].filter(Boolean)
          }
        }
      }
    }
    
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
      result: processing.result ? (typeof processing.result === 'string' ? JSON.parse(processing.result) : processing.result) : null,
      progress: processing.status === 'completed' ? 100 : processing.status === 'generating' ? 50 : 10
    }
  }

  async getProcessingOrders(userId: string) {
    try {
      const db = getMySQLClient()
      return await db.query('order_processing', { user_id: userId }) as any
    } catch (error) {
      // 从内存缓存获取
      const results: any[] = []
      for (const item of memoryCache.values()) {
        if (item.user_id === userId) results.push(item)
      }
      return results
    }
  }
}

import * as crypto from 'crypto'
