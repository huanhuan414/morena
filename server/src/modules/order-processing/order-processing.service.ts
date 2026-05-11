import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { getCache } from '../../common/shared-cache'

@Injectable()
export class OrderProcessingService {
  private readonly logger = new Logger(OrderProcessingService.name)

  /**
   * 查询订单处理状态
   * 优先从数据库查询，数据库无数据则从缓存查询
   */
  async getProcessingStatus(orderId: string, userId: string): Promise<any> {
    this.logger.log(`查询订单处理状态: orderId=${orderId}, userId=${userId}`)

    // 1. 先从数据库查询
    try {
      const db = getMySQLClient()
      const records = await db.query(
        'SELECT * FROM content_generation_requests WHERE order_id = ? ORDER BY created_at DESC',
        [orderId]
      )

      if (records && records[0] && records[0].length > 0) {
        const record = records[0][0]
        this.logger.log(`从数据库找到记录: id=${record.id}, status=${record.status}`)

        let images: string[] = []
        let videos: string[] = []

        try {
          if (record.images) {
            images = typeof record.images === 'string' ? JSON.parse(record.images) : record.images
          }
        } catch (e) { /* ignore parse error */ }

        try {
          if (record.video_url) {
            videos = typeof record.video_url === 'string' ? JSON.parse(record.video_url) : [record.video_url]
          }
        } catch (e) { /* ignore parse error */ }

        return {
          id: record.id,
          order_id: record.order_id,
          avatar_id: record.avatar_id,
          platform: record.platform,
          status: record.status || 'completed',
          generatedContent: {
            content: record.content || '',
            images,
            videos,
            platforms: record.platform ? [record.platform] : [],
          },
          created_at: record.created_at
        }
      }
    } catch (dbError: any) {
      this.logger.warn(`数据库查询失败: ${dbError.message}`)
    }

    // 2. 数据库没有数据，从缓存查询
    const cachedData = getCache(orderId)
    if (cachedData) {
      this.logger.log(`从缓存找到数据: orderId=${orderId}`)
      return cachedData
    }

    // 3. 没有任何数据
    this.logger.log(`未找到订单处理数据: orderId=${orderId}`)
    return null
  }
}
