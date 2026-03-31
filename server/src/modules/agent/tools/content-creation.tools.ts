/**
 * 内容创作工具
 * 使用AI生成文章、图片、视频
 */

import { Injectable } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, VideoGenerationClient } from 'coze-coding-dev-sdk'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'

/**
 * 撰写文章工具
 */
@Injectable()
export class WriteArticleTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'write_article',
    displayName: '撰写文章',
    description: '使用AI生成文章内容，支持指定主题、风格和长度',
    category: 'content_creation',
    paramsSchema: {
      topic: { type: 'string', description: '文章主题', required: true },
      style: { type: 'string', enum: ['formal', 'casual', 'professional', 'creative'], default: 'professional' },
      length: { type: 'number', description: '目标字数', default: 800 },
      keywords: { type: 'array', items: { type: 'string' }, description: '关键词' },
      outline: { type: 'string', description: '文章大纲' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      
      const styleGuide = {
        formal: '正式、严谨、专业',
        casual: '轻松、活泼、亲切',
        professional: '专业、客观、有深度',
        creative: '创意、独特、有想象力'
      }
      
      const prompt = `请撰写一篇关于「${params.topic}」的文章。

要求：
- 风格：${styleGuide[params.style] || '专业、客观'}
- 目标字数：${params.length || 800}字左右
${params.keywords ? `- 包含关键词：${params.keywords.join('、')}` : ''}
${params.outline ? `- 参考大纲：${params.outline}` : ''}

请直接输出文章内容，使用Markdown格式。`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.7
      })

      const content = response.content.trim()
      
      // 生成标题
      const titleMatch = content.match(/^#\s*(.+)$/m)
      const title = titleMatch ? titleMatch[1] : params.topic

      return {
        success: true,
        data: {
          title,
          content,
          word_count: content.length,
          style: params.style,
          message: `文章「${title}」撰写完成，共${content.length}字`
        }
      }
    } catch (err: any) {
      return { success: false, error: `撰写文章失败: ${err.message}` }
    }
  }
}

/**
 * 生成图片工具
 */
@Injectable()
export class GenerateImageTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_image',
    displayName: '生成图片',
    description: '使用AI生成图片',
    category: 'content_creation',
    paramsSchema: {
      prompt: { type: 'string', description: '图片描述', required: true },
      style: { type: 'string', enum: ['realistic', 'artistic', 'anime', '3d'], default: 'realistic' },
      size: { type: 'string', enum: ['1K', '2K', '4K'], default: '2K' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new ImageGenerationClient(config)
      
      console.log('Agent工具 - 生成图片:', params.prompt)
      
      // 根据风格调整提示词
      const stylePrompts = {
        realistic: 'photorealistic, high quality, detailed',
        artistic: 'artistic, creative, masterpiece',
        anime: 'anime style, vibrant colors, detailed',
        '3d': '3D render, high quality, detailed'
      }
      
      const enhancedPrompt = `${params.prompt}, ${stylePrompts[params.style] || stylePrompts.realistic}`
      
      const response = await client.generate({
        prompt: enhancedPrompt,
        size: params.size || '2K',
        watermark: false
      })
      
      const helper = client.getResponseHelper(response)
      
      if (helper.success && helper.imageUrls.length > 0) {
        console.log('Agent工具 - 图片生成成功:', helper.imageUrls[0])
        return {
          success: true,
          data: {
            image_urls: helper.imageUrls,
            prompt: params.prompt,
            style: params.style,
            message: `成功生成${helper.imageUrls.length}张图片`
          }
        }
      } else {
        return { success: false, error: `图片生成失败: ${helper.errorMessages.join(', ')}` }
      }
    } catch (err: any) {
      console.error('Agent工具 - 图片生成异常:', err)
      return { success: false, error: `生成图片失败: ${err.message}` }
    }
  }
}

/**
 * 生成视频工具
 */
@Injectable()
export class GenerateVideoTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_video',
    displayName: '生成视频',
    description: '使用AI生成视频',
    category: 'content_creation',
    paramsSchema: {
      prompt: { type: 'string', description: '视频描述', required: true },
      duration: { type: 'number', description: '视频时长（秒）', default: 5 },
      ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], default: '9:16' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new VideoGenerationClient(config)
      
      console.log('Agent工具 - 生成视频:', params.prompt)
      
      const content = [{ type: 'text' as const, text: params.prompt }]
      
      const response = await client.videoGeneration(content, {
        model: 'doubao-seedance-1-5-pro-251215',
        duration: params.duration || 5,
        ratio: params.ratio || '9:16',
        resolution: '720p',
        generateAudio: true
      })
      
      if (response.videoUrl) {
        console.log('Agent工具 - 视频生成成功:', response.videoUrl)
        return {
          success: true,
          data: {
            video_url: response.videoUrl,
            prompt: params.prompt,
            duration: params.duration || 5,
            message: '视频生成成功'
          }
        }
      } else {
        return { success: false, error: '视频生成失败' }
      }
    } catch (err: any) {
      console.error('Agent工具 - 视频生成异常:', err)
      return { success: false, error: `生成视频失败: ${err.message}` }
    }
  }
}

/**
 * 批量内容生成工具
 */
@Injectable()
export class BatchGenerateTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'batch_generate',
    displayName: '批量生成内容',
    description: '批量生成文章、图片或视频',
    category: 'content_creation',
    paramsSchema: {
      items: { 
        type: 'array', 
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['article', 'image', 'video'] },
            params: { type: 'object' }
          }
        },
        description: '生成项目列表',
        required: true
      }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const results: any[] = []
      const items = params.items || []
      
      for (const item of items) {
        // 这里会调用对应的工具
        results.push({
          type: item.type,
          params: item.params,
          status: 'queued'
        })
      }
      
      return {
        success: true,
        data: {
          total: items.length,
          results,
          message: `已创建${items.length}个生成任务`
        }
      }
    } catch (err: any) {
      return { success: false, error: `批量生成失败: ${err.message}` }
    }
  }
}
