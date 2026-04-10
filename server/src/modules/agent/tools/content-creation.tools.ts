/**
 * 内容创作工具
 * 使用AI生成文章、图片、视频
 */

import { Injectable } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, S3Storage } from 'coze-coding-dev-sdk'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'
import axios from 'axios'

/**
 * 根据文章内容自动添加配图
 * 提取为独立函数，供多个工具使用
 */
async function addImagesToArticleContent(content: string, title: string): Promise<string> {
  try {
    const config = new Config()
    const imageClient = new ImageGenerationClient(config)

    // 生成文章开头封面图
    const coverPrompt = `${title}，文章配图，简约现代风格，专业设计`
    let contentWithImages = ''

    // 生成开头配图
    console.log('正在生成文章开头配图...')
    const coverResponse = await imageClient.generate({
      prompt: `${coverPrompt}, social media style, clean layout`,
      size: '1K',
      watermark: false
    })
    const coverHelper = imageClient.getResponseHelper(coverResponse)

    if (coverHelper.success && coverHelper.imageUrls.length > 0) {
      const coverUrl = coverHelper.imageUrls[0]
      contentWithImages = `![${title}](${coverUrl})\n\n`
      console.log('开头配图生成成功')
    }

    contentWithImages += content

    // 按段落分割，在关键位置插入配图
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    const imagePositions: number[] = []

    // 每隔3-5个段落插入一张配图
    let currentPos = 0
    for (let i = 0; i < paragraphs.length; i++) {
      currentPos += paragraphs[i].length + 2
      if ((i + 1) % 4 === 0 && imagePositions.length < 3) {
        imagePositions.push(currentPos)
      }
    }

    // 为每个位置生成配图
    for (let i = imagePositions.length - 1; i >= 0; i--) {
      const pos = imagePositions[i]
      const nearbyText = content.substring(Math.max(0, pos - 100), pos + 100)

      try {
        console.log(`正在生成第 ${i + 1} 张章节配图...`)
        const imgResponse = await imageClient.generate({
          prompt: `文章配图，抽象概念图，简约现代风格，${nearbyText.substring(0, 50)}`,
          size: '1K',
          watermark: false
        })
        const imgHelper = imageClient.getResponseHelper(imgResponse)

        if (imgHelper.success && imgHelper.imageUrls.length > 0) {
          const imgUrl = imgHelper.imageUrls[0]
          const imageMarkdown = `\n\n![文章配图](${imgUrl})\n\n`
          contentWithImages = contentWithImages.slice(0, pos) + imageMarkdown + contentWithImages.slice(pos)
          console.log(`第 ${i + 1} 张配图插入成功`)
        }
      } catch (err) {
        console.error(`生成第 ${i + 1} 张配图失败:`, err)
      }
    }

    console.log(`文章配图完成，共生成配图`)
    return contentWithImages
  } catch (err) {
    console.error('文章配图失败:', err)
    return content // 失败时返回原始内容
  }
}

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

      // 自动添加文章配图
      console.log('正在为文章添加配图...')
      const contentWithImages = await addImagesToArticleContent(mainContent, titles[0] || params.topic)
      console.log('配图后内容长度:', contentWithImages.length)

      // 构建发布参数模板，方便 Agent 直接使用
      const publishParams = {
        title: titles[0] || params.topic,
        content: contentWithImages, // 使用带配图的内容
        cover_url: coverImageUrl,
        digest: mainContent.substring(0, 54).replace(/\n/g, ' ') + '...'
      }

      return {
        success: true,
        data: {
          title: titles[0] || params.topic,
          title_options: titles,
          content: contentWithImages, // 返回带配图的内容
          cover_image_url: coverImageUrl,
          cover_prompt: coverPrompt,
          tags,
          word_count: mainContent.length,
          message: `公众号爆款图文「${titles[0] || params.topic}」创作完成，共${mainContent.length}字${coverImageUrl ? '，已生成封面图' : ''}`,
          // 提供完整的发布参数，Agent 可以直接使用
          next_action_hint: `内容已生成，如需发布到公众号，请使用 publish_wechat_mp 工具，参数如下：
{
  "title": "${publishParams.title}",
  "content": "请使用上方完整的 content 内容",
  "cover_url": "${publishParams.cover_url || '自动生成'}"
}

注意：请直接使用上方返回的完整 content 内容，不要截断。`
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
          message: `小红书笔记「${titles[0] || params.topic}」创作完成，已复制到下方`,
          // 不再提示 Agent 自动发布，让用户自己决定
          // 用户可以点击"一键发布"按钮来发布
          xiaohongshu_content: {
            title: titles[0] || params.topic,
            content: mainContent,
            tags
          }
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
    description: '根据文字描述生成高质量图片，适用于Logo设计、海报、插画、产品设计等。当用户需要"生成图片"、"画一张图"、"设计Logo"时使用此工具。',
    category: 'content_creation',
    paramsSchema: {
      prompt: { type: 'string', description: '图片描述，详细描述想要生成的图片内容、风格、色彩等', required: true },
      style: { type: 'string', enum: ['realistic', 'artistic', 'anime', '3d', 'logo'], default: 'realistic', description: '图片风格' },
      size: { type: 'string', enum: ['1K', '2K', '4K'], default: '2K', description: '图片分辨率' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      console.log('Agent工具 - 生成图片:', params.prompt)

      // 根据风格调整提示词
      const stylePrompts = {
        realistic: 'photorealistic, high quality, detailed, realistic style, movie quality',
        artistic: 'artistic, creative, masterpiece, painterly',
        anime: 'anime style, vibrant colors, detailed, manga style',
        '3d': '3D render, high quality, detailed, octane render, cinema 4d',
        logo: 'logo design, minimalist, clean, professional branding, vector style, flat design'
      }

      const enhancedPrompt = `${params.prompt}, ${stylePrompts[params.style] || stylePrompts.realistic}`

      // 调用豆包图片生成 API
      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/images/generations'
      const apiKey = process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'

      console.log('Agent工具 - 调用豆包图片生成 API:', {
        prompt_length: enhancedPrompt.length,
        size: params.size || '2K'
      })

      const response = await axios.post(apiUrl, {
        model: 'doubao-seedream-4-0-250828',
        prompt: enhancedPrompt,
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
        timeout: 120000 // 2分钟超时
      })

      console.log('Agent工具 - 豆包图片生成 API响应:', response.status, response.statusText)

      if (response.status !== 200) {
        const errorMsg = response.data?.error?.message || response.data?.message || '图片生成失败'
        console.error('Agent工具 - 图片生成失败:', errorMsg)
        return { success: false, error: `图片生成失败: ${errorMsg}` }
      }

      // 获取生成的图片 URL
      const responseData = response.data
      const imageData = responseData?.data || responseData

      let imageUrls: string[] = []

      // 处理不同的响应格式
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
        console.error('Agent工具 - 未获取到图片URL:', errorMsg, responseData)
        return { success: false, error: `图片生成失败: ${errorMsg}` }
      }

      console.log('Agent工具 - 图片生成成功:', imageUrls[0])

      return {
        success: true,
        data: {
          image_urls: imageUrls,
          prompt: params.prompt,
          style: params.style,
          message: `成功生成${imageUrls.length}张图片`
        }
      }
    } catch (err: any) {
      console.error('Agent工具 - 图片生成异常:', err)

      // 提取更友好的错误信息
      let errorMsg = err.message || '未知错误'

      if (err.response) {
        // API 返回的错误
        const apiError = err.response.data
        errorMsg = apiError?.error?.message || apiError?.message || `API错误 (${err.response.status})`
      } else if (err.code === 'ECONNABORTED' || errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        errorMsg = '图片生成超时，请稍后重试。图片生成通常需要30-60秒。'
      } else if (err.message?.includes('403') || err.statusCode === 403) {
        errorMsg = '图片生成服务暂时不可用，可能是API配额已用完或权限问题，请稍后再试或联系管理员'
      } else if (err.message?.includes('rate limit') || err.message?.includes('429')) {
        errorMsg = '图片生成请求过于频繁，请稍等片刻再试'
      }

      return { success: false, error: `生成图片失败: ${errorMsg}` }
    }
  }
}

/**
 * 生成视频工具
 * 支持多模态输入：文本、参考图片、参考视频、参考音频
 */
@Injectable()
export class GenerateVideoTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'generate_video',
    displayName: '生成视频',
    description: '使用AI生成视频，支持文字描述生成视频，支持参考图片、视频、音频。当用户需要"生成视频"、"做一个视频"、"创作视频"时使用此工具。注意：视频生成需要1-5分钟，请耐心等待。',
    category: 'content_creation',
    paramsSchema: {
      prompt: { type: 'string', description: '视频内容描述，详细描述想要生成的视频画面、动作、风格等', required: true },
      duration: { type: 'number', description: '视频时长（秒），支持4-12秒，默认5秒', default: 5 },
      ratio: { type: 'string', enum: ['16:9', '9:16', '1:1', 'adaptive'], default: '9:16', description: '视频比例，9:16适合手机竖屏，16:9适合横屏，adaptive自动选择' },
      reference_images: { type: 'array', items: { type: 'string' }, description: '参考图片URL列表（可选）' },
      reference_videos: { type: 'array', items: { type: 'string' }, description: '参考视频URL列表（可选）' },
      reference_audios: { type: 'array', items: { type: 'string' }, description: '参考音频URL列表（可选）' },
      generate_audio: { type: 'boolean', description: '是否自动生成音频', default: true }
    }
  }

  private storage: S3Storage

  constructor() {
    // 初始化火山引擎 TOS 存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-beijing.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morina-ai',
      region: 'cn-beijing',
    })
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      console.log('Agent工具 - 生成视频开始:', params.prompt?.substring(0, 100))
      console.log('Agent工具 - 视频参数:', { duration: params.duration, ratio: params.ratio })

      // 构建 content 数组
      const content: any[] = []

      // 添加文本描述
      content.push({
        type: 'text',
        text: params.prompt
      })

      // 添加参考图片
      if (params.reference_images && Array.isArray(params.reference_images)) {
        for (const imgUrl of params.reference_images) {
          content.push({
            type: 'image_url',
            image_url: { url: imgUrl },
            role: 'reference_image'
          })
        }
      }

      // 添加参考视频
      if (params.reference_videos && Array.isArray(params.reference_videos)) {
        for (const videoUrl of params.reference_videos) {
          content.push({
            type: 'video_url',
            video_url: { url: videoUrl },
            role: 'reference_video'
          })
        }
      }

      // 添加参考音频
      if (params.reference_audios && Array.isArray(params.reference_audios)) {
        for (const audioUrl of params.reference_audios) {
          content.push({
            type: 'audio_url',
            audio_url: { url: audioUrl },
            role: 'reference_audio'
          })
        }
      }

      // 调用豆包视频生成 API
      const apiUrl = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks'
      const apiKey = process.env.VOLC_VIDEO_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47'

      console.log('Agent工具 - 调用豆包视频生成 API:', {
        content_count: content.length,
        has_reference_images: params.reference_images?.length || 0,
        has_reference_videos: params.reference_videos?.length || 0,
        has_reference_audios: params.reference_audios?.length || 0
      })

      const response = await axios.post(apiUrl, {
        model: 'doubao-seedance-2-0-260128',
        content: content,
        generate_audio: params.generate_audio !== false, // 默认生成音频
        ratio: params.ratio || '9:16',
        duration: params.duration || 5,
        watermark: false
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        timeout: 300000 // 5分钟超时
      })

      console.log('Agent工具 - 豆包API响应:', response.status, response.statusText)

      if (response.status !== 200) {
        const errorMsg = response.data?.error?.message || response.data?.message || '视频生成失败'
        console.error('Agent工具 - 视频生成失败:', errorMsg)
        return { success: false, error: `视频生成失败: ${errorMsg}` }
      }

      // 获取生成的视频 URL
      const responseData = response.data
      const videoUrl = responseData?.data?.result_url || responseData?.result_url || responseData?.video_url

      if (!videoUrl) {
        const errorMsg = responseData?.message || '未返回视频URL'
        console.error('Agent工具 - 未获取到视频URL:', errorMsg, responseData)
        return { success: false, error: `视频生成失败: ${errorMsg}` }
      }

      console.log('Agent工具 - 视频生成成功，原始URL:', videoUrl)

      // 上传到火山引擎 TOS CDN，确保 URL 长期有效
      try {
        console.log('Agent工具 - 正在上传视频到 CDN...')
        const videoKey = await this.storage.uploadFromUrl({ url: videoUrl, timeout: 60000 })
        console.log('Agent工具 - CDN 上传成功, key:', videoKey)

        // 生成 CDN 访问 URL（30天有效期）
        const cdnUrl = await this.storage.generatePresignedUrl({
          key: videoKey,
          expireTime: 86400 * 30 // 30天有效期
        })
        console.log('Agent工具 - CDN URL:', cdnUrl)

        return {
          success: true,
          data: {
            video_url: cdnUrl,
            video_key: videoKey,
            prompt: params.prompt,
            duration: params.duration || 5,
            ratio: params.ratio || '9:16',
            has_reference_images: params.reference_images?.length || 0,
            has_reference_videos: params.reference_videos?.length || 0,
            has_reference_audios: params.reference_audios?.length || 0,
            generate_audio: params.generate_audio !== false,
            message: `视频生成成功！时长: ${params.duration || 5}秒${params.reference_images?.length ? `，使用${params.reference_images.length}张参考图片` : ''}`
          }
        }
      } catch (cdnErr: any) {
        console.error('Agent工具 - CDN 上传失败，使用原始URL:', cdnErr)
        // CDN 上传失败时，返回原始 URL（可能会有过期问题）
        return {
          success: true,
          data: {
            video_url: videoUrl,
            prompt: params.prompt,
            duration: params.duration || 5,
            ratio: params.ratio || '9:16',
            has_reference_images: params.reference_images?.length || 0,
            has_reference_videos: params.reference_videos?.length || 0,
            has_reference_audios: params.reference_audios?.length || 0,
            generate_audio: params.generate_audio !== false,
            message: `视频生成成功！时长: ${params.duration || 5}秒（注意：视频链接可能在一段时间后过期）`
          }
        }
      }
    } catch (err: any) {
      console.error('Agent工具 - 视频生成异常:', err)

      // 提取更友好的错误信息
      let errorMsg = err.message || '未知错误'

      if (err.response) {
        // API 返回的错误
        const apiError = err.response.data
        errorMsg = apiError?.error?.message || apiError?.message || `API错误 (${err.response.status})`
      } else if (err.code === 'ECONNABORTED' || errorMsg.includes('timeout') || errorMsg.includes('Timeout')) {
        errorMsg = '视频生成超时，请稍后重试。视频生成通常需要1-5分钟。'
      }

      return { success: false, error: `生成视频失败: ${errorMsg}` }
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
