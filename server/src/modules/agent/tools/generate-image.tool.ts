import { ITool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { ImageGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import * as crypto from 'crypto'

/**
 * 图片生成工具
 * 使用豆包大模型生成高质量图片，并上传到火山引擎CDN
 */
export class GenerateImageTool implements ITool {
  name = 'generate_image'
  description = '根据文本描述生成高质量图片，支持2K/4K分辨率，可用于海报、插画、产品设计等场景'

  private storage: S3Storage

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morena-ai',
      region: 'cn-guangzhou',
    })
  }

  parameters = {
    type: 'object' as const,
    properties: {
      prompt: { type: 'string' as const, description: '图片描述，详细描述想要生成的图片内容、风格、色彩等' },
      size: { type: 'string' as const, description: '图片尺寸：2K（默认）、4K', default: '2K' },
      style: { type: 'string' as const, description: '图片风格：realistic、anime、oil_painting、watercolor等', default: 'realistic' }
    },
    required: ['prompt']
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    const { prompt, size = '2K', style = 'realistic' } = params
    const { userId, avatarId, taskId, headers } = context
    const db = getMySQLClient()

    try {
      // 更新任务进度
      await db.updateWhere('tasks', { id: taskId }, { progress: 20 })

      // 构建增强的提示词
      const enhancedPrompt = this.buildEnhancedPrompt(prompt, style)

      // 调用图片生成API
      const config = new Config()
      const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
      const imageClient = new ImageGenerationClient(config, customHeaders)

      const response = await imageClient.generate({
        prompt: enhancedPrompt,
        size: size as any,
        watermark: false
      })

      const helper = imageClient.getResponseHelper(response)

      if (!helper.success || helper.imageUrls.length === 0) {
        throw new Error(helper.errorMessages.join('; ') || '图片生成失败')
      }

      const originalUrl = helper.imageUrls[0]

      // 更新进度：正在上传到CDN
      await db.updateWhere('tasks', { id: taskId }, { progress: 60 })

      // 上传到火山引擎CDN
      const imageKey = await this.storage.uploadFromUrl({ url: originalUrl, timeout: 30000 })

      // 生成CDN访问URL
      const cdnUrl = await this.storage.generatePresignedUrl({ key: imageKey, expireTime: 86400 * 30 })

      // 保存生成的图片记录到数据库
      const recordId = crypto.randomUUID()
      // 确保用户存在，避免外键约束报错
      const [existingUser] = await db.query('SELECT id FROM users WHERE id = ?', [userId]) as any
      if (existingUser.length === 0) {
        await db.query(
          `INSERT IGNORE INTO users (id, openid, nickname, level, exp, credits, created_at, updated_at)
           VALUES (?, ?, ?, 1, 0, 0, NOW(), NOW())`,
          [userId, `auto_${userId}`, `用户${userId.slice(0, 6)}`]
        )
      }
      await db.insert('generated_content', {
        id: recordId,
        user_id: userId,
        avatar_id: avatarId,
        task_id: taskId,
        type: 'image',
        prompt: prompt,
        url: cdnUrl,
        storage_key: imageKey,
        metadata: JSON.stringify({ size, style, model: response.model }),
        created_at: new Date()
      })

      // 更新任务结果
      await db.updateWhere('tasks', { id: taskId }, {
        progress: 100,
        result: JSON.stringify({ type: 'image', url: cdnUrl, key: imageKey, prompt, style, size, recordId }),
        status: 'completed',
        completed_at: new Date()
      })

      return {
        success: true,
        message: "操作成功",
        data: { url: cdnUrl, key: imageKey, prompt, style, size }
      }
    } catch (error: any) {
      console.error('[GenerateImageTool] 生成失败:', error)

      await db.updateWhere('tasks', { id: taskId }, {
        status: 'failed',
        result: JSON.stringify({ error: error.message })
      }).catch(() => {})

      return { success: false, error: error.message || '图片生成失败', message: '图片生成失败' }
    }
  }

  private buildEnhancedPrompt(prompt: string, style: string): string {
    const styleEnhancements: Record<string, string> = {
      realistic: 'photorealistic, high detail, professional photography, 8k resolution',
      anime: 'anime style, vibrant colors, clean lines, Japanese animation aesthetic',
      oil_painting: 'oil painting style, rich textures, classical art, masterpiece',
      watercolor: 'watercolor painting, soft colors, artistic, dreamy atmosphere',
      sketch: 'pencil sketch, detailed linework, artistic drawing, monochrome',
      poster: 'poster design, bold typography, eye-catching, professional layout',
      logo: 'logo design, minimalist, clean, professional branding',
      '3d': '3D render, realistic lighting, detailed textures, high quality'
    }
    const enhancement = styleEnhancements[style] || styleEnhancements.realistic
    return `${prompt}, ${enhancement}, high quality, detailed`
  }
}
