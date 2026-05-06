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
      const imageCount = Math.min(params.images_count || 3, 9)
      const contentWithImages = await this.addImagesToArticleContent(mainContent, titles[0] || params.topic, imageCount)

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

  private async addImagesToArticleContent(content: string, topic: string, imageCount: number = 3): Promise<string> {
    // 公众号文章配图 - 每张图片内容方向完全不同，都围绕主题，适合公众号推广
    const articleTopic = topic || '内容分享'
    
    // 核心：每张图片的画面完全不同，确保AI生成不同的图片
    const wechatMpScenes: string[] = [
      // 图片1：职场办公场景
      `微信公众号风格，一位专业女性职场精英在现代办公室，${articleTopic}完美融入场景，白领职业装，自然柔和光线，高端职场感，${articleTopic}质感完美，专业感强，适合职场公众号，让人想点击`,
      // 图片2：户外旅行大片
      `微信公众号风格，${articleTopic}与海边日落结合，金色阳光，${articleTopic}在风景中，电影感人像构图，高饱和度暖色调，${articleTopic}质感完美，大片感强，让人向往远方`,
      // 图片3：精致美食场景
      `微信公众号美食风格，${articleTopic}精致美食摄影，${articleTopic}作为美食主角，马卡龙粉色系，木质或白色餐盘，${articleTopic}让人流口水，商业美食摄影，让人食欲大增`,
      // 图片4：科技数码展示
      `微信公众号科技风格，${articleTopic}科技产品展示，${articleTopic}单品，纯白背景专业摄影，现代科技感，高清质感，${articleTopic}完美呈现，适合科技公众号，让人想购买`,
      // 图片5：家居生活场景
      `微信公众号生活风格，${articleTopic}在温馨家居场景，${articleTopic}质感完美，奶油色系家居，柔和暖光，${articleTopic}融入生活，居家感强，治愈系风格，让人想收藏`,
      // 图片6：时尚穿搭展示
      `微信公众号时尚风格，${articleTopic}单品穿搭展示，${articleTopic}作为主角，日系原宿风，同色系搭配，简约背景，专业时尚摄影，让人想购买的冲动感`,
      // 图片7：商务会议场景
      `微信公众号商业风格，${articleTopic}在精致商务会议中，${articleTopic}质感完美，深色商务装，正式会议场景，${articleTopic}完美呈现，商务感强，适合商业公众号`,
      // 图片8：艺术插画风格
      `微信公众号插画风格，${articleTopic}精致插画设计，扁平化插画，${articleTopic}元素明确，柔和粉彩色调，温暖氛围，杂志排版感，文艺气息浓厚，让人眼前一亮`
    ]
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    if (paragraphs.length === 0) return content

    // 根据 imageCount 选择不同场景的提示词
    const imagePrompts = wechatMpScenes.slice(0, imageCount)

    let imageUrls: string[] = []
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)

      for (let i = 0; i < imagePrompts.length; i++) {
        const prompt = imagePrompts[i]
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

      // 生成配图 - 每张图片内容方向完全不同，都围绕主题，适合小红书推广分享
      const imageCount = Math.min(params.images_count || 3, 9)
      const xhsTopic = params.topic || '分享'
      
      // 核心：每张图片的画面完全不同，确保AI生成不同的图片
      const xhsImagePrompts: string[] = [
        // 图片1：精致下午茶场景
        `小红书风格，一位年轻女生在阳光咖啡厅享受下午茶，${xhsTopic}精致摆盘，提拉米苏或马卡龙，马卡龙粉色系，木质桌面，窗边自然光，暖色调，画面精美，高画质，适合小红书种草分享`,
        // 图片2：卧室温馨角落
        `小红书风格，${xhsTopic}在温馨卧室床上展示，白色奶油色床品，${xhsTopic}质感完美，柔和暖黄灯光，复古抱枕装饰，居家生活感，${xhsTopic}质感完美呈现，治愈系风格，让人想收藏`,
        // 图片3：户外旅行日记
        `小红书风格，${xhsTopic}与海边日落风景结合，金色沙滩，${xhsTopic}在草帽或野餐垫上，日落橙色调，电影感人像构图，高饱和度，${xhsTopic}融入旅途，让人向往远方`,
        // 图片4：美食摄影特写
        `小红书美食风格，${xhsTopic}精致特写镜头，单反微距摄影，${xhsTopic}质感完美，浅景深虚化背景，马卡龙色调，商业美食摄影风格，${xhsTopic}让人流口水食欲感`,
        // 图片5：时尚穿搭展示
        `小红书时尚风格，${xhsTopic}单品穿搭展示，${xhsTopic}作为主角，日系原宿风，同色系搭配，简约白色背景，专业时尚摄影，让人想购买的冲动感`,
        // 图片6：护肤场景
        `小红书护肤风格，${xhsTopic}精致护肤场景，玻璃瓶身，玫瑰花瓣装饰，${xhsTopic}质感完美，干玫瑰色系，自然光柔和光线，${xhsTopic}精致感，纯欲风格，小红书爆款`,
        // 图片7：书房学习场景
        `小红书文艺风格，${xhsTopic}在精致书房展示，木质书架背景，台灯暖黄光，复古书籍装饰，${xhsTopic}融入文艺氛围，文青风格，让人想收藏`,
        // 图片8：咖啡厅工作场景
        `小红书生活风格，${xhsTopic}在文艺咖啡厅中，${xhsTopic}在精心布置的桌面上，拿铁咖啡，${xhsTopic}质感完美，窗边光线，文青感，记录美好生活`
      ].slice(0, imageCount)

      const imageUrls: string[] = []
      try {
        const config = new Config()
        const imageClient = new ImageGenerationClient(config)

        for (let i = 0; i < xhsImagePrompts.length; i++) {
          const prompt = xhsImagePrompts[i]
          const uniqueId = `${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const uniquePrompt = `${prompt} [图片序号: ${i + 1}, 唯一ID: ${uniqueId}]`
          try {
            const response = await imageClient.generate({
              prompt: uniquePrompt,
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

      // 生成配图 - 每张图片内容方向完全不同，都围绕需求主题，适合推广分享
      const imageCount = Math.min(params.image_count || 3, 9)
      const topic = params.topic || '生活分享'
      
      // 核心：每张图片的画面完全不同，确保AI生成不同的图片
      const imagePrompts = [
        // 图片1：城市街景，年轻人拿着产品
        `朋友圈风格摄影，一位年轻女性/男性手持${topic}，站在繁忙的城市街道，背景是霓虹灯和现代建筑，清晨自然光，高画质，人物占画面三分之一，自然抓拍感，真实生活气息，适合社交媒体`,
        // 图片2：海边日落，产品融入风景
        `朋友圈分享风格${topic}，黄昏时分海边日落场景，${topic}作为画面核心道具摆放，暖橙色天空，海浪沙滩，电影感构图，广角视野，大片质感，让人向往远方`,
        // 图片3：咖啡厅精致下午茶场景
        `朋友圈种草风格，精致的咖啡厅下午茶场景，${topic}完美融入场景，原木桌面，绿色植物点缀，拿铁拉花，${topic}质感完美，阳光透过窗户照射，小清新治愈系，画面精美`,
        // 图片4：卧室温馨角落，产品展示
        `朋友圈风格场景照，${topic}在温馨的卧室角落展示，米白色床品，暖色台灯，${topic}质感完美呈现，居家生活感，温暖治愈，让人想收藏，摄影作品质感`,
        // 图片5：户外露营野餐场景
        `朋友圈旅行风格${topic}，户外露营野餐场景，${topic}在野餐垫上展示，蓝天白云，草地树林，${topic}融入自然氛围，清新自然风，让人想体验，广角构图`,
        // 图片6：厨房烹饪场景
        `朋友圈美食风格${topic}，现代厨房烹饪场景，${topic}作为主角展示，不锈钢厨具背景，自然光从窗户射入，${topic}质感完美，烟火气与生活感，记录美好生活`,
        // 图片7：健身房运动场景
        `朋友圈运动风格${topic}，现代健身房场景，${topic}作为运动装备展示，镜子反射，器材背景，${topic}质感强，充满活力，阳光透过天窗，健康生活态度`,
        // 图片8：书桌学习工作场景
        `朋友圈学习风格${topic}，简约书桌学习工作场景，${topic}在精心布置的桌面上，文具书本咖啡，${topic}质感完美，文艺清新，窗边自然光，积极向上的生活态度`
      ].slice(0, imageCount)

      const imageUrls: string[] = []
      try {
        const imageClient = new ImageGenerationClient(config)

        for (let i = 0; i < imagePrompts.length; i++) {
          const promptText = imagePrompts[i]
          // 添加唯一标识确保每次生成都不同
          const uniqueId = `${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const uniquePrompt = `${promptText} [图片序号: ${i + 1}, 唯一ID: ${uniqueId}]`
          try {
            const imgResponse = await imageClient.generate({
              prompt: uniquePrompt,
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
