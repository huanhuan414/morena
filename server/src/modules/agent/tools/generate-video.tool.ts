import { ITool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { VideoGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

/**
 * 视频生成工具
 * 使用豆包大模型生成高质量视频
 */
export class GenerateVideoTool implements ITool {
  name = 'generate_video'
  description = '根据文本描述生成高质量视频，支持4-12秒时长，可生成带音频的视频，适用于短视频、动画、广告等场景'
  
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
        description: '首帧图片URL（可选），用于图片转视频'
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

    console.log('[GenerateVideoTool] 开始生成视频:', { prompt, duration, ratio, resolution })

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

      // 构建内容数组
      const content: any[] = []

      // 如果有首帧图片，添加图片内容
      if (firstFrameUrl) {
        content.push({
          type: 'image_url' as const,
          image_url: { url: firstFrameUrl },
          role: 'first_frame' as const
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
        model: 'doubao-seedance-1-5-pro-251215',
        duration,
        ratio: ratio as any,
        resolution: resolution as any,
        generateAudio
      })

      const videoUrl = response.videoUrl

      if (!videoUrl) {
        throw new Error(response.response?.error_message || '视频生成失败')
      }

      console.log('[GenerateVideoTool] 视频生成成功:', videoUrl)

      // 保存生成的视频记录到数据库
      const { data: videoRecord } = await client
        .from('generated_content')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          task_id: taskId,
          type: 'video',
          prompt: prompt,
          url: videoUrl,
          metadata: {
            duration,
            ratio,
            resolution,
            hasAudio: generateAudio,
            firstFrameUrl
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
            url: videoUrl,
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
          url: videoUrl,
          prompt,
          duration,
          ratio,
          resolution
        },
        message: `视频已生成成功！${videoUrl}`
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
