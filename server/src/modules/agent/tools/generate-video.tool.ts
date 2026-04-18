import { ITool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { VideoGenerationClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

/**
 * 视频生成工具
 * 使用豆包大模型生成高质量视频，并上传到火山引擎CDN
 */
export class GenerateVideoTool implements ITool {
  name = 'generate_video'
  description = '根据文本描述生成高质量视频，支持4-12秒时长，可生成带音频的视频，适用于短视频、动画、广告等场景。如果用户上传了图片，可以使用图片作为首帧参考（first_frame），确保视频内容与图片一致。如果用户没有上传图片，只使用文本描述生成视频。'
  
  private storage: S3Storage

  constructor() {
    // 初始化火山引擎CDN存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-beijing.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morina-ai',
      region: 'cn-beijing',
    })
  }

  parameters = {
    type: 'object' as const,
    properties: {
      prompt: {
        type: 'string' as const,
        description: '视频内容描述，详细描述视频场景、动作、镜头运动等'
      },
      duration: {
        type: 'number' as const,
        description: '视频时长（秒），支持4-12秒，默认5秒',
        default: 5
      },
      ratio: {
        type: 'string' as const,
        description: '视频比例：16:9（横屏）、9:16（竖屏）、1:1（方形）',
        default: '16:9'
      },
      resolution: {
        type: 'string' as const,
        description: '分辨率：480p、720p、1080p',
        default: '720p'
      },
      generateAudio: {
        type: 'boolean' as const,
        description: '是否生成音频（配音、音效、背景音乐）',
        default: true
      },
      firstFrameUrl: {
        type: 'string' as const,
        description: '首帧图片URL（可选），用于图片转视频。注意：只支持AI生成的图片，不支持真实人物照片。'
      }
    },
    required: ['prompt']
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    const {
      prompt,
      duration = 5,
      ratio = '16:9',
      resolution = '720p',
      generateAudio = true,
      firstFrameUrl
    } = params
    const { userId, avatarId, taskId, headers } = context

    console.log('[GenerateVideoTool] 开始生成视频:', { prompt, duration, ratio, resolution, hasFirstFrame: !!firstFrameUrl })

    const client = getSupabaseClient()

    try {
      // 更新任务进度
      await client
        .from('tasks')
        .update({
          progress: 10,
          logs: [{
            tool: 'generate_video',
            action: '正在生成视频，预计需要1-3分钟...',
            timestamp: new Date().toISOString()
          }]
        })
        .eq('id', taskId)

      // 调用视频生成API
      const config = new Config()
      const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
      const videoClient = new VideoGenerationClient(config, customHeaders)

      // 🔴 根据用户是否上传图片来决定是否使用图片
      const content: any[] = []

      // 如果用户上传了首帧图片，添加图片内容（使用 first_frame 角色）
      if (firstFrameUrl) {
        console.log('[GenerateVideoTool] 使用用户上传的首帧图片:', firstFrameUrl.substring(0, 50))
        content.push({
          type: 'image_url' as const,
          image_url: { url: firstFrameUrl },
          role: 'first_frame' as const // ✅ 使用 first_frame 而不是 reference_image
        })
      }

      // 添加文本描述
      content.push({
        type: 'text' as const,
        text: prompt
      })

      // 更新进度
      await client
        .from('tasks')
        .update({ progress: 20 })
        .eq('id', taskId)

      const response = await videoClient.videoGeneration(content, {
        model: 'doubao-seedance-2-0-260128', // 🔴 最新模型，支持 duration、ratio、watermark、generate_audio
        duration,
        ratio: ratio as any,
        resolution: resolution as any,
        generateAudio,
        watermark: false // 默认不加水印
      })

      const originalUrl = response.videoUrl

      if (!originalUrl) {
        throw new Error(response.response?.error_message || '视频生成失败')
      }

      console.log('[GenerateVideoTool] 视频生成成功:', originalUrl)

      // 更新进度：正在上传到CDN
      await client
        .from('tasks')
        .update({
          progress: 70,
          logs: [{
            tool: 'generate_video',
            action: '正在上传到火山引擎CDN...',
            timestamp: new Date().toISOString()
          }]
        })
        .eq('id', taskId)

      // 上传到火山引擎CDN
      const videoKey = await this.storage.uploadFromUrl({ url: originalUrl, timeout: 60000 })
      console.log('[GenerateVideoTool] 上传CDN成功, key:', videoKey)

      // 生成CDN访问URL
      const cdnUrl = await this.storage.generatePresignedUrl({
        key: videoKey,
        expireTime: 86400 * 30 // 30天有效期
      })
      console.log('[GenerateVideoTool] CDN URL:', cdnUrl)

      // 保存生成的视频记录到数据库
      const { data: videoRecord } = await client
        .from('generated_content')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          task_id: taskId,
          type: 'video',
          prompt: prompt,
          url: cdnUrl,
          storage_key: videoKey,
          metadata: {
            duration,
            ratio,
            resolution,
            hasAudio: generateAudio,
            hasFirstFrame: !!firstFrameUrl,
            firstFrameUrl: firstFrameUrl || null,
            original_url: originalUrl
          }
        })
        .select()
        .single()

      // 更新任务结果
      await client
        .from('tasks')
        .update({
          progress: 100,
          result: {
            type: 'video',
            url: cdnUrl,
            key: videoKey,
            prompt,
            duration,
            ratio,
            resolution,
            hasAudio: generateAudio,
            recordId: videoRecord?.id
          },
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)

      return {
        success: true,
        data: {
          url: cdnUrl,
          key: videoKey,
          prompt,
          duration,
          ratio,
          resolution
        },
        message: `视频已生成成功！`,
        percentage: 100 // 视频生成完成
      }
    } catch (error) {
      console.error('[GenerateVideoTool] 生成失败:', error)
      
      // 更新任务状态为失败
      await client
        .from('tasks')
        .update({
          status: 'failed',
          result: { error: error.message }
        })
        .eq('id', taskId)

      return {
        success: false,
        error: error.message || '视频生成失败',
        message: `视频生成失败: ${error.message || '未知错误'}`
      }
    }
  }
}
