// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class OrderProcessingService {
  private readonly logger = new Logger(OrderProcessingService.name)

  /**
   * 根据 orderId 查询内容生成状态
   * 直接查 content_generation_requests 表
   */
  async getProcessingStatus(orderId: string) {
    try {
      const db = getMySQLClient()

      // 按 order_id 查询所有生成记录
      const rows = await db.query(
        'SELECT * FROM content_generation_requests WHERE order_id = ? ORDER BY created_at DESC',
        [orderId]
      )

      if (!rows || rows.length === 0) {
        this.logger.log(`订单 ${orderId} 无生成记录`)
        return null
      }

      // 合并所有平台的生成结果
      const allContent: string[] = []
      const allImages: string[] = []
      const allVideos: string[] = []
      const platforms: string[] = []
      let overallStatus = 'completed'
      let requestId = rows[0].id

      for (const row of rows) {
        if (row.status !== 'completed') {
          overallStatus = row.status || 'processing'
        }
        if (row.platform) platforms.push(row.platform)
        if (row.content) allContent.push(row.content)
        if (row.images) {
          try {
            const imgs = typeof row.images === 'string' ? JSON.parse(row.images) : row.images
            if (Array.isArray(imgs)) allImages.push(...imgs)
          } catch (e) { this.logger.warn('解析 images 失败') }
        }
        if (row.videoUrl) {
          try {
            const vids = typeof row.videoUrl === 'string' ? JSON.parse(row.videoUrl) : row.videoUrl
            if (Array.isArray(vids)) allVideos.push(...vids)
            else if (typeof vids === 'string') allVideos.push(vids)
          } catch (e) { allVideos.push(row.videoUrl) }
        }
      }

      this.logger.log(`订单 ${orderId} 查到 ${rows.length} 条生成记录, 状态: ${overallStatus}`)

      return {
        orderId,
        orderTitle: '商单内容',
        status: overallStatus,
        requestId,
        generatedContent: {
          content: allContent.join('\n\n---\n\n'),
          images: allImages,
          videos: allVideos,
          platforms: [...new Set(platforms)]
        }
      }
    } catch (error) {
      this.logger.error(`查询生成状态失败: ${error.message}`)
      return null
    }
  }

  /**
   * 根据 requestId 查询单条生成记录
   */
  async getProcessingByRequestId(requestId: string) {
    try {
      const db = getMySQLClient()
      const rows = await db.query(
        'SELECT * FROM content_generation_requests WHERE id = ?',
        [requestId]
      )

      if (!rows || rows.length === 0) return null

      const row = rows[0]
      let images = []
      let videos = []
      try {
        images = row.images ? (typeof row.images === 'string' ? JSON.parse(row.images) : row.images) : []
      } catch (e) { images = [] }
      try {
        videos = row.videoUrl ? (typeof row.videoUrl === 'string' ? JSON.parse(row.videoUrl) : row.videoUrl) : []
      } catch (e) { videos = [] }

      return {
        orderId: row.orderId,
        orderTitle: '商单内容',
        status: row.status || 'pending',
        requestId: row.id,
        generatedContent: {
          content: row.content || '',
          images: Array.isArray(images) ? images : [],
          videos: Array.isArray(videos) ? videos : [],
          platforms: row.platform ? [row.platform] : []
        }
      }
    } catch (error) {
      this.logger.error(`查询生成状态失败: ${error.message}`)
      return null
    }
  }

  async createProcessingOrder(data: {
    order_id: string
    avatar_id: string
    user_id: string
    config?: Record<string, any>
  }) {
    const id = crypto.randomUUID()
    return { id }
  }

  async updateProcessingStatus(processingId: string, status: string, result?: Record<string, any>) {
    return { success: true }
  }

  async getProcessingOrders(userId: string) {
    return []
  }
}

import * as crypto from 'crypto'
