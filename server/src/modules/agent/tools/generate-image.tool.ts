import { ITool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

/**
 * 图片生成工具
 * 使用豆包大模型生成高质量图片
 */
export class GenerateImageTool implements ITool {
  name = 'generate_image'
  description = '根据文本描述生成高质量图片，支持2K/4K分辨率，可用于海报、插画、产品设计等场景'
  
  parameters = {
    type: 'object' as const,
    properties: {
      prompt: {
        type: 'string' as const,
        description: '图片描述，详细描述想要生成的图片内容、风格、色彩等'
      },
      size: {
        type: 'string' as const,
        description: '图片尺寸：2K（默认）、4K，或自定义如 2560x1440',
        default: '2K'
      },
      style: {
        type: 'string' as const,
        description: '图片风格：realistic（写实）、anime（动漫）、oil_painting（油画）、watercolor（水彩）、sketch（素描）等',
        default: 'realistic'
      }
    },
    required: ['prompt']
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    const { prompt, size = '2K', style = 'realistic' } = params
    const { userId, avatarId, taskId, headers } = context

    console.log('[GenerateImageTool] 开始生成图片:', { prompt, size, style })

    const client = getSupabaseClient()

    try {
      // 更新任务进度
      await client
        .from('tasks')
        .update({
          progress: 20,
          logs: client.rpc('array_append', {
            arr: 'logs',
            value: {
              tool: 'generate_image',
              action: '正在生成图片...',
              timestamp: new Date().toISOString()
            }
          })
        })
        .eq('id', taskId)

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

      const imageUrl = helper.imageUrls[0]
      console.log('[GenerateImageTool] 图片生成成功:', imageUrl)

      // 保存生成的图片记录到数据库
      const { data: imageRecord } = await client
        .from('generated_content')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          task_id: taskId,
          type: 'image',
          prompt: prompt,
          url: imageUrl,
          metadata: {
            size,
            style,
            model: response.model
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
            type: 'image',
            url: imageUrl,
            prompt,
            style,
            size,
            recordId: imageRecord?.id
          },
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)

      return {
        success: true,
        data: {
          url: imageUrl,
          prompt,
          style,
          size
        },
        message: `图片已生成成功！${imageUrl}`
      }
    } catch (error) {
      console.error('[GenerateImageTool] 生成失败:', error)
      
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
        error: error.message || '图片生成失败',
        message: `图片生成失败: ${error.message || '未知错误'}`
      }
    }
  }

  /**
   * 构建增强的提示词
   */
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
