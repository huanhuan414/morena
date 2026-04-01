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
 * 撰写公众号爆款图文工具
 * 专门用于生成适合微信公众号传播的爆款内容
 */
@Injectable()
export class WriteWechatMpArticleTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'write_wechat_mp_article',
    displayName: '撰写公众号爆款图文',
    description: '生成适合微信公众号传播的爆款图文，包含吸睛标题、短段落、金句、引导关注等元素。此工具仅生成内容，发布需要配合 publish_wechat_mp 工具。',
    category: 'content_creation',
    paramsSchema: {
      topic: { type: 'string', description: '文章主题/话题', required: true },
      target_audience: { type: 'string', description: '目标受众（如：职场人、宝妈、大学生）' },
      emotion: { type: 'string', enum: ['励志', '治愈', '干货', '情感', '热点'], default: '干货' },
      keywords: { type: 'array', items: { type: 'string' }, description: '关键词/标签' },
      include_cover: { type: 'boolean', description: '是否生成封面图', default: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      
      const emotionStyles = {
        励志: '积极向上，激发斗志，让人充满力量',
        治愈: '温暖人心，缓解焦虑，给人安慰',
        干货: '实用有价值，解决实际问题，方法论明确',
        情感: '引发共鸣，触动人心，情感真挚',
        热点: '紧跟时事，观点鲜明，引发讨论'
      }

      const prompt = `你是一位专业的公众号爆款文案撰写专家。请为以下主题撰写一篇公众号爆款图文：

主题：${params.topic}
${params.target_audience ? `目标受众：${params.target_audience}` : ''}
情感基调：${emotionStyles[params.emotion] || emotionStyles.干货}
${params.keywords?.length ? `关键词：${params.keywords.join('、')}` : ''}

请严格按照以下公众号爆款格式输出：

## 标题
（生成3-5个吸睛标题选项，使用标题党技巧：数字、疑问、反差、悬念、情绪词等）

## 封面图提示词
（用一句话描述适合的封面图片风格和内容，用于AI生成封面图）

## 正文

（正文要求：）
1. 开头用一个金句或故事引入，快速抓住读者注意力
2. 段落要短，每段不超过3行，方便手机阅读
3. 每2-3段插入一个「金句卡片」或「重点标记」，格式如下：
   > 💡 金句内容
   
4. 适当使用emoji增加亲和力 😊
5. 正文1000-2000字为宜
6. 结尾要有行动引导（点赞、在看、关注、转发）

## 标签
（生成3-5个适合的公众号标签）

---

现在开始创作：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8 // 更高的温度增加创意
      })

      let articleContent = response.content.trim()
      
      // 解析标题选项
      const titleSection = articleContent.match(/## 标题\n([\s\S]*?)(?=## 封面图|$)/i)
      let titles: string[] = []
      if (titleSection) {
        titles = titleSection[1].split('\n')
          .map((t: string) => t.replace(/^[\d\.\-\*]+\s*/, '').trim())
          .filter((t: string) => t.length > 0)
      }
      
      // 解析封面图提示词
      const coverMatch = articleContent.match(/## 封面图提示词\n([\s\S]*?)(?=## 正文|$)/i)
      const coverPrompt = coverMatch ? coverMatch[1].trim() : `${params.topic}，清新简约风格`
      
      // 解析正文
      const contentMatch = articleContent.match(/## 正文\n([\s\S]*?)(?=## 标签|$)/i)
      const mainContent = contentMatch ? contentMatch[1].trim() : articleContent
      
      // 解析标签
      const tagsMatch = articleContent.match(/## 标签\n([\s\S]*?)$/i)
      let tags: string[] = []
      if (tagsMatch) {
        tags = tagsMatch[1].split(/[,，\n]/)
          .map((t: string) => t.replace(/^[\#\－\*]+\s*/, '').trim())
          .filter((t: string) => t.length > 0)
      }

      // 如果需要生成封面图
      let coverImageUrl: string | undefined
      if (params.include_cover) {
        try {
          const imageClient = new ImageGenerationClient(config)
          const imageResponse = await imageClient.generate({
            prompt: `${coverPrompt}, social media cover style, clean and modern, text-friendly background`,
            size: '1K',
            watermark: false
          })
          const helper = imageClient.getResponseHelper(imageResponse)
          if (helper.success && helper.imageUrls.length > 0) {
            coverImageUrl = helper.imageUrls[0]
          }
        } catch (imgErr) {
          console.error('生成封面图失败:', imgErr)
        }
      }

      return {
        success: true,
        data: {
          title: titles[0] || params.topic,
          title_options: titles,
          content: mainContent,
          cover_image_url: coverImageUrl,
          cover_prompt: coverPrompt,
          tags,
          word_count: mainContent.length,
          message: `公众号爆款图文「${titles[0] || params.topic}」创作完成，共${mainContent.length}字${coverImageUrl ? '，已生成封面图' : ''}`,
          // 提示 Agent 可以继续发布
          next_action_hint: '内容已生成，如需发布到公众号，请使用 publish_wechat_mp 工具'
        }
      }
    } catch (err: any) {
      return { success: false, error: `撰写公众号图文失败: ${err.message}` }
    }
  }
}

/**
 * 撰写小红书笔记工具
 */
@Injectable()
export class WriteXiaohongshuNoteTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'write_xiaohongshu_note',
    displayName: '撰写小红书笔记',
    description: '生成适合小红书传播的爆款笔记，包含emoji标题、分段式正文、话题标签。此工具仅生成内容，发布需要配合 publish_xiaohongshu 工具。',
    category: 'content_creation',
    paramsSchema: {
      topic: { type: 'string', description: '笔记主题', required: true },
      style: { type: 'string', enum: ['种草', '干货', '分享', '吐槽', '安利'], default: '干货' },
      images_count: { type: 'number', description: '配图数量（1-9张）', default: 3 }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      
      const prompt = `你是一位小红书爆款笔记撰写专家。请为以下主题撰写一篇小红书笔记：

主题：${params.topic}
风格：${params.style}

请严格按照以下小红书爆款格式输出：

## 标题
（生成3个带emoji的吸睛标题，20字以内）

## 正文
（小红书风格：）
1. 开头用emoji和提问/感叹句吸引注意
2. 分点阐述，每点用emoji开头
3. 中间穿插「」强调关键词
4. 结尾引导互动（点赞收藏评论）

## 话题标签
（生成5-10个热门话题标签，带#号）

---

现在开始创作：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      const content = response.content.trim()
      
      // 解析标题
      const titleSection = content.match(/## 标题\n([\s\S]*?)(?=## 正文|$)/i)
      let titles: string[] = []
      if (titleSection) {
        titles = titleSection[1].split('\n')
          .map((t: string) => t.replace(/^[\d\.\-\*]+\s*/, '').trim())
          .filter((t: string) => t.length > 0)
      }
      
      // 解析正文
      const contentMatch = content.match(/## 正文\n([\s\S]*?)(?=## 话题|$)/i)
      const mainContent = contentMatch ? contentMatch[1].trim() : content
      
      // 解析标签
      const tagsMatch = content.match(/## 话题标签\n([\s\S]*?)$/i)
      let tags: string[] = []
      if (tagsMatch) {
        tags = tagsMatch[1].match(/#[^\s#]+/g) || []
      }

      return {
        success: true,
        data: {
          title: titles[0] || params.topic,
          title_options: titles,
          content: mainContent,
          tags,
          message: `小红书笔记「${titles[0] || params.topic}」创作完成`,
          next_action_hint: '内容已生成，如需发布到小红书，请使用 publish_xiaohongshu 工具'
        }
      }
    } catch (err: any) {
      return { success: false, error: `撰写小红书笔记失败: ${err.message}` }
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
