/**
 * Content Creation Tools for Avatar Agent
 * 分身内容创作工具（从旧 Agent 系统迁移）
 */

import { Injectable } from '@nestjs/common'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import { Config, LLMClient, ImageGenerationClient } from 'coze-coding-dev-sdk'

/**
 * 撰写公众号爆款图文工具
 */
@Injectable()
export class WriteWechatMpArticleTool implements AvatarTool {
  name = 'write_wechat_mp_article'
  displayName = '撰写公众号爆款图文'
  description = '生成适合微信公众号传播的爆款图文，包含吸睛标题、短段落、金句、引导关注等元素。此工具仅生成内容，发布需要配合 publish_wechat_mp 工具。'
  category = 'content_creation' as const

  paramsSchema = {
    topic: {
      type: 'string' as const,
      description: '文章主题/话题',
      required: true
    },
    target_audience: {
      type: 'string' as const,
      description: '目标受众（如：职场人、宝妈、大学生）'
    },
    emotion: {
      type: 'string' as const,
      description: '情感基调',
      enum: ['励志', '治愈', '干货', '情感', '热点'],
      default: '干货'
    },
    keywords: {
      type: 'array' as const,
      description: '关键词/标签',
      items: { type: 'string' as const }
    },
    include_cover: {
      type: 'boolean' as const,
      description: '是否生成封面图',
      default: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
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
        temperature: 0.8
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
      const contentWithImages = await this.addImagesToArticleContent(mainContent, titles[0] || params.topic)

      return {
        success: true,
        toolName: this.name,
        data: {
          title: titles[0] || params.topic,
          title_options: titles,
          content: contentWithImages,
          cover_image_url: coverImageUrl,
          cover_prompt: coverPrompt,
          tags,
          word_count: mainContent.length,
          message: `公众号爆款图文「${titles[0] || params.topic}」创作完成，共${mainContent.length}字${coverImageUrl ? '，已生成封面图' : ''}`,
          next_action_hint: `内容已生成，如需发布到公众号，请使用 publish_wechat_mp 工具，参数如下：
{
  "title": "${titles[0] || params.topic}",
  "content": "请使用上方完整的 content 内容",
  "cover_url": "${coverImageUrl || '自动生成'}"
}

注意：请直接使用上方返回的完整 content 内容，不要截断。`
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      return {
        success: false,
        toolName: this.name,
        error: `撰写公众号图文失败: ${err.message}`,
        executionTime: Date.now() - Date.now()
      }
    }
  }

  private async addImagesToArticleContent(content: string, topic: string): Promise<string> {
    // 简化版：在文章开头和中间添加1-2张配图
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    if (paragraphs.length === 0) return content

    const imagePrompts = [
      `${topic}, 插图风格, 清新简约`,
      `${topic}, 信息图表风格, 现代设计`
    ]

    let imageUrls: string[] = []
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)

      for (const prompt of imagePrompts) {
        try {
          const response = await imageClient.generate({
            prompt: `${prompt}, 4K, high quality`,
            size: '1K',
            watermark: false
          })
          const helper = imageClient.getResponseHelper(response)
          if (helper.success && helper.imageUrls.length > 0) {
            imageUrls.push(helper.imageUrls[0])
          }
        } catch (err) {
          console.error('生成配图失败:', err)
        }
      }
    } catch (err) {
      console.error('添加文章配图失败:', err)
    }

    // 在文章中插入图片
    const result: string[] = []
    for (let i = 0; i < paragraphs.length; i++) {
      result.push(paragraphs[i])

      // 在开头和中间插入图片
      if (i === 0 && imageUrls[0]) {
        result.push(`![配图1](${imageUrls[0]})`)
      } else if (i === Math.floor(paragraphs.length / 2) && imageUrls[1]) {
        result.push(`![配图2](${imageUrls[1]})`)
      }
    }

    return result.join('\n\n')
  }
}

/**
 * 撰写小红书笔记工具
 */
@Injectable()
export class WriteXiaohongshuNoteTool implements AvatarTool {
  name = 'write_xiaohongshu_note'
  displayName = '撰写小红书笔记'
  description = '生成适合小红书传播的爆款笔记，包含emoji标题、分段式正文、话题标签。此工具仅生成内容，发布需要配合 publish_xiaohongshu 工具。'
  category = 'content_creation' as const

  paramsSchema = {
    topic: {
      type: 'string' as const,
      description: '笔记主题',
      required: true
    },
    style: {
      type: 'string' as const,
      description: '笔记风格',
      enum: ['种草', '干货', '分享', '吐槽', '安利'],
      default: '干货'
    },
    images_count: {
      type: 'number' as const,
      description: '配图数量（1-9张）',
      default: 3
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
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

      // 生成配图
      const imageCount = Math.min(params.images_count || 3, 9)
      const imagePrompts = Array.from({ length: imageCount }, (_, i) =>
        `${params.topic} 小红书风格${i + 1}, ${params.style}, ${i === 0 ? '封面图' : '配图'}, 高质量, 4K`
      )

      const imageUrls: string[] = []
      try {
        const config = new Config()
        const imageClient = new ImageGenerationClient(config)

        for (const prompt of imagePrompts) {
          try {
            const response = await imageClient.generate({
              prompt,
              size: '1K',
              watermark: false
            })
            const helper = imageClient.getResponseHelper(response)
            if (helper.success && helper.imageUrls.length > 0) {
              imageUrls.push(helper.imageUrls[0])
            }
          } catch (err) {
            console.error('生成配图失败:', err)
          }
        }
      } catch (err) {
        console.error('批量生成配图失败:', err)
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          title: titles[0] || params.topic,
          title_options: titles,
          content: mainContent,
          tags,
          images: imageUrls,
          message: `小红书笔记「${titles[0] || params.topic}」创作完成，已生成${imageUrls.length}张配图`,
          xiaohongshu_content: {
            title: titles[0] || params.topic,
            content: mainContent,
            tags,
            images: imageUrls
          }
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      return {
        success: false,
        toolName: this.name,
        error: `撰写小红书笔记失败: ${err.message}`,
        executionTime: Date.now() - Date.now()
      }
    }
  }
}

/**
 * 撰写微信朋友圈内容工具（朋友圈爆款文案）
 */
@Injectable()
export class WriteWechatMomentsTool implements AvatarTool {
  name = 'write_wechat_moments_content'
  displayName = '撰写微信朋友圈爆款文案'
  description = '生成适合微信朋友圈传播的爆款内容，包含简短精炼的文案和生活化的配图。此工具仅生成内容，发布需要配合发布功能。'
  category = 'content_creation' as const

  paramsSchema = {
    topic: {
      type: 'string' as const,
      description: '内容主题/话题',
      required: true
    },
    content_type: {
      type: 'string' as const,
      description: '内容类型',
      enum: ['图文', '纯文字', '纯图片'],
      default: '图文'
    },
    image_count: {
      type: 'number' as const,
      description: '配图数量（1-9张）',
      default: 3
    },
    style: {
      type: 'string' as const,
      description: '内容风格',
      enum: ['生活分享', '工作感悟', '产品推广', '日常打卡', '情感表达'],
      default: '生活分享'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
      const config = new Config()
      const client = new LLMClient(config)

      // 朋友圈文案风格指南
      const styleGuides = {
        '生活分享': '真实自然的生活记录，分享日常趣事或实用好物，语气像朋友聊天',
        '工作感悟': '职场心得、成长感悟、经验分享，传递正能量但不鸡汤',
        '产品推广': '软性植入，不生硬，像朋友推荐好东西一样自然',
        '日常打卡': '健身、学习、美食等打卡记录，展示自律生活',
        '情感表达': '亲情、友情、爱情的感悟，真挚动人但不矫情'
      }

      const prompt = `你是一位深谙微信朋友圈传播规律的文案专家。请为以下主题创作一条朋友圈内容：

主题：${params.topic}
内容类型：${params.content_type}
风格：${styleGuides[params.style] || styleGuides['生活分享']}
配图数量：${params.image_count}张

【重要提醒】
这是微信朋友圈（WeChat Moments）内容，不是小红书！朋友圈内容特点：
- 文字简短精炼：30-80字左右
- 语言风格：生活化、口语化、真实分享感
- 避免使用："姐妹们"、"宝子们"、"真的绝"、"种草"等小红书式表达
- 不要写太长的正文，朋友圈用户习惯快速浏览
- 可以用 emoji 增加趣味性和活力

请严格按照以下格式输出：

## 文案
（30-80字的精炼文案，符合朋友圈风格，可包含emoji）

## 配图提示词
（生成${params.image_count}张朋友圈配图的AI生成提示词，每张一句话描述）
（图片风格要求：生活化、真实感、暖色调为主，符合朋友圈分享风格）

## 互动引导
（可选：如果适合，添加一句简短的互动引导，如"你们觉得呢？"）

---

现在开始创作：`

      const response = await client.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })

      const content = response.content.trim()

      // 解析文案
      const textSection = content.match(/## 文案\n([\s\S]*?)(?=## 配图|$)/i)
      let mainText = ''
      if (textSection) {
        mainText = textSection[1].trim()
      }

      // 解析互动引导
      const interactionMatch = content.match(/## 互动引导\n([\s\S]*?)$/i)
      const interaction = interactionMatch ? interactionMatch[1].trim() : ''

      // 合并文案和互动引导
      if (interaction) {
        mainText = mainText + '\n\n' + interaction
      }

      // 生成配图
      const imageCount = Math.min(params.image_count || 3, 9)
      const imagePrompts = Array.from({ length: imageCount }, (_, i) => {
        const style = params.style || '生活分享'
        // 每张图片使用不同的角度和构图，确保生成不同的图片
        const angleOptions = [
          '正面视角，简洁背景',
          '侧面视角，自然光线',
          '俯视角度，平铺展示',
          '仰视角度，创意构图',
          '近景特写，突出主体',
          '远景视角，交代环境',
          '局部细节，手持展示',
          '生活场景，自然状态',
          '精致摆放，专业摄影'
        ]
        const angle = angleOptions[i % angleOptions.length]
        return `${params.topic}，朋友圈风格，${styleGuides[style]}，${angle}，暖色调，高质量，4K`
      })

      const imageUrls: string[] = []
      try {
        const imageClient = new ImageGenerationClient(config)

        for (const promptText of imagePrompts) {
          try {
            const imgResponse = await imageClient.generate({
              prompt: promptText,
              size: '1K',
              watermark: false
            })
            const helper = imageClient.getResponseHelper(imgResponse)
            if (helper.success && helper.imageUrls.length > 0) {
              imageUrls.push(helper.imageUrls[0])
            }
          } catch (err) {
            console.error('生成朋友圈配图失败:', err)
          }
        }
      } catch (err) {
        console.error('批量生成朋友圈配图失败:', err)
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          text: mainText,
          images: imageUrls,
          image_count: imageUrls.length,
          style: params.style || '生活分享',
          message: `朋友圈文案「${params.topic}」创作完成，已生成${imageUrls.length}张配图`,
          wechat_moments_content: {
            text: mainText,
            images: imageUrls,
            image_count: imageUrls.length
          }
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      return {
        success: false,
        toolName: this.name,
        error: `撰写朋友圈内容失败: ${err.message}`,
        executionTime: Date.now() - Date.now()
      }
    }
  }
}

// Part 1/3
