import { ITool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { VideoGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import * as crypto from 'crypto'

/**
 * 视频生成工具
 * 使用豆包大模型生成高质量视频，并上传到火山引擎CDN
 */
export class GenerateVideoTool implements ITool {
  name = 'generate_video'
  description = '根据文本描述生成高质量视频，支持4-12秒时长，可生成带音频的视频'

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
      prompt: { type: 'string' as const, description: '视频内容描述，详细描述视频场景、动作、镜头运动等' },
      duration: { type: 'number' as const, description: '视频时长（秒），支持4-12秒，默认5秒', default: 5 },
      ratio: { type: 'string' as const, description: '视频比例：16:9（横屏）、9:16（竖屏）、1:1（方形）', default: '16:9' },
      resolution: { type: 'string' as const, description: '分辨率：480p、720p、1080p', default: '720p' },
      generateAudio: { type: 'boolean' as const, description: '是否生成音频', default: true },
      firstFrameUrl: { type: 'string' as const, description: '首帧图片URL（可选）' }
    },
    required: ['prompt']
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    const { prompt, duration = 5, ratio = '16:9', resolution = '720p', generateAudio = true, firstFrameUrl } = params
    const { userId, avatarId, taskId, headers } = context
    const db = getMySQLClient()

    try {
      // 更新任务进度
      await db.updateWhere('tasks', { id: taskId }, { progress: 10 })

      // 调用视频生成API
      const config = new Config()
      const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
      const videoClient = new VideoGenerationClient(config, customHeaders)

      // 处理首帧图片
      const content: any[] = []
      let finalPrompt = prompt
      if (firstFrameUrl) {
        if (!finalPrompt.includes('图片') && !finalPrompt.includes('参考')) {
          finalPrompt = `基于提供的首帧图片，${finalPrompt}`
        }
        if (firstFrameUrl.includes('tos-cn-') && firstFrameUrl.includes('volces.com')) {
          content.push({ type: 'image_url' as const, image_url: { url: firstFrameUrl }, role: 'first_frame' as const })
        } else {
          try {
            const imgResponse = await fetch(firstFrameUrl)
            if (imgResponse.ok) {
              const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
              const imgKey = await this.storage.uploadFile({
                fileContent: imgBuffer,
                fileName: `video-first-frame/${Date.now()}.jpg`,
                contentType: 'image/jpeg'
              })
              const tosImgUrl = await this.storage.generatePresignedUrl({ key: imgKey, expireTime: 86400 * 7 })
              content.push({ type: 'image_url' as const, image_url: { url: tosImgUrl }, role: 'first_frame' as const })
            }
          } catch (e) { /* 忽略图片处理错误 */ }
        }
      }
      content.push({ type: 'text' as const, text: finalPrompt })

      await db.updateWhere('tasks', { id: taskId }, { progress: 20 })

      const response = await videoClient.videoGeneration(content, {
        model: 'doubao-seedance-2-0-260128',
        duration,
        ratio: ratio as any,
        resolution: resolution as any,
        generateAudio,
        watermark: false
      })

      const originalUrl = response.videoUrl
      if (!originalUrl) {
        throw new Error(response.response?.error_message || '视频生成失败')
      }


      // 上传到火山引擎CDN
      await db.updateWhere('tasks', { id: taskId }, { progress: 70 })
      const videoKey = await this.storage.uploadFromUrl({ url: originalUrl, timeout: 60000 })
      const cdnUrl = await this.storage.generatePresignedUrl({ key: videoKey, expireTime: 86400 * 30 })

      // 保存记录
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
        type: 'video',
        prompt: prompt,
        url: cdnUrl,
        storage_key: videoKey,
        metadata: JSON.stringify({ duration, ratio, resolution, generateAudio, hasFirstFrame: !!firstFrameUrl }),
        created_at: new Date()
      })

      // 更新任务结果
      await db.updateWhere('tasks', { id: taskId }, {
        progress: 100,
        result: JSON.stringify({ type: 'video', url: cdnUrl, key: videoKey, prompt, duration, ratio, resolution }),
        status: 'completed',
        completed_at: new Date()
      })

      return {
        success: true,
        message: "操作成功",
        data: { url: cdnUrl, key: videoKey, prompt, duration, ratio, resolution }
      }
    } catch (error: any) {
      console.error('[GenerateVideoTool] 生成失败:', error)
      await db.updateWhere('tasks', { id: taskId }, {
        status: 'failed',
        result: JSON.stringify({ error: error.message })
      }).catch(() => {})
      return { success: false, error: error.message || '视频生成失败', message: '视频生成失败' }
    }
  }
}
