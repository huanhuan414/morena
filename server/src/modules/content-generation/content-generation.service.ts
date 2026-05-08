import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

const PLATFORM_TOOL_MAPPING: Record<string, string> = {
  wechat_mp: 'write_wechat_mp_article',
  xiaohongshu: 'write_xiaohongshu_note',
  douyin: 'generate_video',
  weibo: 'write_wechat_mp_article',
  bilibili: 'generate_video',
  kuaishou: 'generate_video',
  wechat_moments: 'write_wechat_moments_content'
}

@Injectable()
export class ContentGenerationService {
  private readonly logger = new Logger(ContentGenerationService.name)

  async generateContent(input: {
    orderId: string
    requestId: string
    avatarId: string
    orderTitle: string
    orderDescription: string
    platforms: string[]
    contentType: string
    targetAudience: string
    avatarName?: string
    avatarPersonality?: string
    quantity?: number
  }): Promise<any[]> {
    const results: any[] = []
    const db = getMySQLClient()

    for (const platform of input.platforms) {
      try {
        this.logger.log(`为平台 ${platform} 生成内容...`)

        // 记录生成请求
        const insertResult = await db.insert('content_generation_requests', {
          id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          avatar_id: input.avatarId,
          order_id: input.orderId,
          platform,
          status: 'pending',
          created_at: new Date()
        }) as any

        results.push({
          platform,
          requestId: (insertResult as any).insertId || insertResult,
          success: true
        })
      } catch (error: any) {
        this.logger.error(`生成内容失败: ${error.message}`)
        results.push({
          platform,
          success: false,
          error: error.message
        })
      }
    }

    return results
  }

  async getGeneratedContent(requestId: string, avatarId: string): Promise<any> {
    const db = getMySQLClient()
    const result = await db.query('content_generation_requests', {
      id: requestId,
      avatar_id: avatarId
    })
    return result?.data?.[0] || null
  }

  async updateContentStatus(contentId: string, status: string): Promise<void> {
    const db = getMySQLClient()
    await db.updateWhere('content_generation_requests', { id: contentId }, { status })
  }
}
