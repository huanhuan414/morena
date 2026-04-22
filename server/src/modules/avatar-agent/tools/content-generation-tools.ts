/**
 * Content Creation Tools for Avatar Agent - Part 2
 * 图片和视频生成工具
 */

import { Injectable } from '@nestjs/common'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import axios from 'axios'
import { S3Storage } from 'coze-coding-dev-sdk'

/**
 * 专业提示词优化器 - 图片
 */
class ImagePromptOptimizer {
  static optimize(prompt: string, style: string): string {
    const stylePrefixes = {
      realistic: 'photorealistic, 8K, ultra detailed, professional photography',
      artistic: 'digital art, artistic style, beautiful composition, vibrant colors',
      anime: 'anime style, manga, vibrant colors, clean lines',
      '3d': '3D render, blender, octane render, high quality, detailed',
      logo: 'minimalist logo design, vector, clean lines, professional'
    }

    const basePrompt = stylePrefixes[style] || stylePrefixes.realistic
    return `${basePrompt}, ${prompt}, high quality, masterpiece`
  }
}

/**
 * 专业提示词优化器 - 视频
 */
class VideoPromptOptimizer {
  static optimize(prompt: string, duration: number, ratio: string): string {
    const durationPrefix = duration > 8 ? 'epic, long shot' : 'dynamic, engaging'
    const ratioPrefix = ratio === '16:9' ? 'widescreen' : ratio === '9:16' ? 'portrait' : 'square'

    return `${durationPrefix}, ${ratioPrefix}, ${prompt}, high quality, smooth motion, cinematic`
  }
}

/**
 * 生成图片工具
 */
@Injectable()
export class GenerateImageTool implements AvatarTool {
  name = 'generate_image'
  displayName = '生成图片'
  description = '根据文字描述生成高质量图片，适用于Logo设计、海报、插画、产品设计等。当用户需要"生成图片"、"画一张图"、"设计Logo"时使用此工具。'
  category = 'content_creation' as const

  paramsSchema = {
    prompt: {
      type: 'string' as const,
      description: '图片描述，详细描述想要生成的图片内容、风格、色彩等',
      required: true
    },
    style: {
      type: 'string' as const,
      description: '图片风格',
      enum: ['realistic', 'artistic', 'anime', '3d', 'logo'],
      default: 'realistic'
    },
    size: {
      type: 'string' as const,
      description: '图片分辨率',
      enum: ['1K', '2K', '4K'],
      default: '2K'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
      console.log('AvatarAgent工具 - 生成图片:', params.prompt)

      const optimizedPrompt = ImagePromptOptimizer.optimize(params.prompt, params.style || 'realistic')

      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
      const apiKey = process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'

      console.log('AvatarAgent工具 - 调用豆包图片生成 API:', {
        prompt_length: optimizedPrompt.length,
        size: params.size || '2K',
        style: params.style || 'realistic'
      })

      const response = await axios.post(apiUrl, {
        model: 'doubao-seedream-4-0-250828',
        prompt: optimizedPrompt,
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: params.size || '2K',
        stream: false,
        watermark: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 120000
      })

      if (response.status !== 200) {
        const errorMsg = response.data?.error?.message || response.data?.message || '图片生成失败'
        return { success: false, toolName: this.name, error: `图片生成失败: ${errorMsg}` }
      }

      const responseData = response.data
      const imageData = responseData?.data || responseData

      let imageUrls: string[] = []

      if (Array.isArray(imageData)) {
        imageUrls = imageData.map((img: any) => img.url).filter(Boolean)
      } else if (imageData?.url) {
        imageUrls = [imageData.url]
      } else if (imageData?.image_urls) {
        imageUrls = imageData.image_urls
      } else if (typeof responseData === 'string') {
        imageUrls = [responseData]
      }

      if (imageUrls.length === 0) {
        const errorMsg = responseData?.message || '未获取到图片URL'
        return { success: false, toolName: this.name, error: `图片生成失败: ${errorMsg}` }
      }

      console.log('AvatarAgent工具 - 图片生成成功，CDN URL:', imageUrls[0])

      return {
        success: true,
        toolName: this.name,
        data: {
          image_urls: imageUrls,
          prompt: params.prompt,
          optimized_prompt: optimizedPrompt,
          style: params.style,
          size: params.size,
          cdn_urls: imageUrls,
          message: `成功生成${imageUrls.length}张图片，已保存到火山引擎CDN`
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      console.error('AvatarAgent工具 - 图片生成异常:', err)

      let errorMsg = err.message || '未知错误'

      if (err.response) {
        const apiError = err.response.data
        errorMsg = apiError?.error?.message || apiError?.message || `API错误 (${err.response.status})`
      } else if (err.code === 'ECONNABORTED' || errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        errorMsg = '图片生成超时，请稍后重试。图片生成通常需要30-60秒。'
      } else if (err.message?.includes('403') || err.statusCode === 403) {
        errorMsg = '图片生成服务暂时不可用，可能是API配额已用完或权限问题，请稍后再试或联系管理员'
      } else if (err.message?.includes('rate limit') || err.message?.includes('429')) {
        errorMsg = '图片生成请求过于频繁，请稍等片刻再试'
      }

      return { success: false, toolName: this.name, error: `生成图片失败: ${errorMsg}` }
    }
  }
}

/**
 * 生成视频工具
 * 支持多模态输入：文本、参考图片、参考视频、参考音频
 */
@Injectable()
export class GenerateVideoTool implements AvatarTool {
  name = 'generate_video'
  displayName = '生成视频'
  description = '使用AI生成视频，支持文字描述生成视频，支持参考图片、视频、音频。当用户需要"生成视频"、"做一个视频"、"创作视频"时使用此工具。注意：视频生成需要1-5分钟，请耐心等待。'
  category = 'content_creation' as const

  paramsSchema = {
    prompt: {
      type: 'string' as const,
      description: '视频内容描述，详细描述想要生成的视频画面、动作、风格等',
      required: true
    },
    duration: {
      type: 'number' as const,
      description: '视频时长（秒），支持4-12秒，默认5秒',
      default: 5
    },
    ratio: {
      type: 'string' as const,
      description: '视频比例，9:16适合手机竖屏，16:9适合横屏，adaptive自动选择',
      enum: ['16:9', '9:16', '1:1', 'adaptive'],
      default: '9:16'
    },
    reference_images: {
      type: 'array' as const,
      description: '参考图片URL列表（可选）',
      items: { type: 'string' as const }
    },
    reference_videos: {
      type: 'array' as const,
      description: '参考视频URL列表（可选）',
      items: { type: 'string' as const }
    },
    reference_audios: {
      type: 'array' as const,
      description: '参考音频URL列表（可选）',
      items: { type: 'string' as const }
    },
    generate_audio: {
      type: 'boolean' as const,
      description: '是否自动生成音频',
      default: true
    }
  }

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

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
      console.log('AvatarAgent工具 - 生成视频开始:', params.prompt?.substring(0, 100))

      const optimizedPrompt = VideoPromptOptimizer.optimize(
        params.prompt,
        params.duration || 5,
        params.ratio || '9:16'
      )

      const content: any[] = []
      content.push({
        type: 'text',
        text: optimizedPrompt
      })

      if (params.reference_images && Array.isArray(params.reference_images)) {
        for (const imgUrl of params.reference_images) {
          content.push({
            type: 'image_url',
            image_url: { url: imgUrl },
            role: 'reference_image'
          })
        }
      }

      if (params.reference_videos && Array.isArray(params.reference_videos)) {
        for (const videoUrl of params.reference_videos) {
          content.push({
            type: 'video_url',
            video_url: { url: videoUrl },
            role: 'reference_video'
          })
        }
      }

      if (params.reference_audios && Array.isArray(params.reference_audios)) {
        for (const audioUrl of params.reference_audios) {
          content.push({
            type: 'audio_url',
            audio_url: { url: audioUrl },
            role: 'reference_audio'
          })
        }
      }

      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'
      const apiKey = process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'

      const response = await axios.post(apiUrl, {
        model: 'doubao-seedance-2-0-260128',
        content: content,
        generate_audio: params.generate_audio !== false,
        ratio: params.ratio || '9:16',
        duration: params.duration || 5,
        watermark: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 300000
      })

      if (response.status !== 200) {
        const errorMsg = response.data?.error?.message || response.data?.message || '视频生成失败'
        return { success: false, toolName: this.name, error: `视频生成失败: ${errorMsg}` }
      }

      const taskId = response.data?.id || response.data?.task_id

      if (!taskId) {
        const errorMsg = response.data?.message || '未返回任务ID'
        return { success: false, toolName: this.name, error: `视频生成失败: ${errorMsg}` }
      }

      console.log('AvatarAgent工具 - 视频生成任务已提交，任务ID:', taskId)

      const maxAttempts = 100
      let videoUrl: string | null = null
      let taskStatus = 'pending'
      let attempt = 0

      while (attempt < maxAttempts && !videoUrl) {
        attempt++
        await new Promise(resolve => setTimeout(resolve, 3000))

        try {
          const statusResponse = await axios.get(
            `https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/${taskId}`,
            {
              headers: {
                'Authorization': `Bearer ${apiKey}`
              },
              timeout: 30000
            }
          )

          if (statusResponse.status !== 200) continue

          const taskData = statusResponse.data
          taskStatus = taskData?.status || 'unknown'

          if (taskStatus === 'succeeded' || taskStatus === 'succeed' || taskStatus === 'success') {
            videoUrl = taskData?.content?.video_url || taskData?.data?.result_url || taskData?.result_url || taskData?.video_url
            if (videoUrl) break
          } else if (taskStatus === 'failed' || taskStatus === 'error') {
            const errorMsg = taskData?.error?.message || taskData?.message || '视频生成任务失败'
            return { success: false, toolName: this.name, error: `视频生成任务失败: ${errorMsg}` }
          }

        } catch (pollErr: any) {
          console.error('AvatarAgent工具 - 轮询任务状态异常:', pollErr.message)
          continue
        }
      }

      if (!videoUrl) {
        const errorMsg = `视频生成超时，任务状态：${taskStatus}。视频生成通常需要1-5分钟，请稍后再试。`
        return { success: false, toolName: this.name, error: errorMsg }
      }

      let finalVideoUrl = videoUrl
      if (!videoUrl.includes('tos-cn-guangzhou')) {
        try {
          const response = await fetch(videoUrl)
          const buffer = Buffer.from(await response.arrayBuffer())
          const timestamp = Date.now()
          const filename = `agent-video-${timestamp}.mp4`
          const videoKey = await this.storage.uploadFile({
            fileContent: buffer,
            fileName: `agent-videos/${filename}`,
            contentType: 'video/mp4'
          })
          finalVideoUrl = await this.storage.generatePresignedUrl({
            key: videoKey,
            expireTime: 86400 * 30
          })
        } catch (uploadErr: any) {
          return { success: false, toolName: this.name, error: `视频上传到CDN失败: ${uploadErr.message}` }
        }
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          video_url: finalVideoUrl,
          prompt: params.prompt,
          optimized_prompt: optimizedPrompt,
          duration: params.duration || 5,
          ratio: params.ratio || '9:16',
          cdn_url: finalVideoUrl,
          generate_audio: params.generate_audio !== false,
          has_reference_images: params.reference_images?.length || 0,
          has_reference_videos: params.reference_videos?.length || 0,
          has_reference_audios: params.reference_audios?.length || 0,
          message: `成功生成视频，已保存到火山引擎CDN，时长${params.duration || 5}秒，比例${params.ratio || '9:16'}`
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      console.error('AvatarAgent工具 - 视频生成异常:', err)

      let errorMsg = err.message || '未知错误'

      if (err.response) {
        const apiError = err.response.data
        errorMsg = apiError?.error?.message || apiError?.message || `API错误 (${err.response.status})`
      } else if (err.code === 'ECONNABORTED' || errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        errorMsg = '视频生成超时，请稍后重试。视频生成通常需要1-5分钟。'
      } else if (err.message?.includes('403') || err.statusCode === 403) {
        errorMsg = '视频生成服务暂时不可用，可能是API配额已用完或权限问题，请稍后再试或联系管理员'
      } else if (err.message?.includes('rate limit') || err.message?.includes('429')) {
        errorMsg = '视频生成请求过于频繁，请稍等片刻再试'
      }

      return { success: false, toolName: this.name, error: `生成视频失败: ${errorMsg}` }
    }
  }
}

// Part 2/3
