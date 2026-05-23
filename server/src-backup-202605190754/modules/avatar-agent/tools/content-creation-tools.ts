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
      const imageCount = Math.min(params.images_count || 1, 9)
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
    // 公众号文章配图 - 每张图片视觉风格完全不同，都围绕需求主题，适合公众号推广
    const articleTopic = topic || '内容分享'
    
    // 核心：每张图片的视觉风格完全不同，确保AI生成差异巨大的图片
    const wechatMpScenes: string[] = [
      // 图片1：信息图表风格
      `微信公众号风格信息图表，${articleTopic}数据可视化，${articleTopic}完美呈现，${articleTopic}质感强，现代扁平化设计，${articleTopic}质感强，专业蓝白色系，商业图表风格，让人想点击了解`,
      // 图片2：国潮插画风格
      `微信公众号国潮风格，${articleTopic}融入中式美学，${articleTopic}质感强，朱红金色主调，${articleTopic}质感强，古典元素，现代构图，国风韵味，东方美，让人眼前一亮`,
      // 图片3：电影感人像风格
      `微信公众号电影感风格，${articleTopic}与电影感构图结合，${articleTopic}质感强，${articleTopic}质感强，暖色光晕，${articleTopic}质感强，电影色调，${articleTopic}质感强，大片感强`,
      // 图片4：手绘涂鸦风格
      `微信公众号手绘风格，${articleTopic}手绘插画，${articleTopic}质感强，${articleTopic}质感强，涂鸦元素，彩色笔触，${articleTopic}质感强，活泼可爱风格，手帐感，让人想收藏`,
      // 图片5：杂志大片风格
      `微信公众号杂志风格，${articleTopic}时尚大片感，${articleTopic}质感强，${articleTopic}质感强，高级灰调，${articleTopic}质感强，杂志封面构图，商业摄影，大牌质感，让人印象深刻`,
      // 图片6：像素游戏风格
      `微信公众号像素风格，${articleTopic}像素游戏画面，${articleTopic}质感强，${articleTopic}质感强，8-bit像素风格，${articleTopic}质感强，${articleTopic}质感强，怀旧游戏感，让人回忆童年`,
      // 图片7：拼贴艺术风格
      `微信公众号拼贴风格，${articleTopic}时尚拼贴画，${articleTopic}质感强，${articleTopic}质感强，杂志剪报感，复古色调，${articleTopic}质感强，${articleTopic}质感强，艺术感爆棚`,
      // 图片8：油画质感风格
      `微信公众号油画风格，${articleTopic}油画质感画面，${articleTopic}质感强，${articleTopic}质感强，伦勃朗光，${articleTopic}质感强，暖色调，${articleTopic}质感强，博物馆级质感，艺术收藏感`
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

      // 生成配图 - 每张图片视觉风格完全不同，都围绕需求主题，适合小红书推广分享
      const imageCount = Math.min(params.images_count || 1, 9)
      const xhsTopic = params.topic || '分享'
      
      // 核心：每张图片的视觉风格完全不同，确保AI生成差异巨大的图片
      const xhsImagePrompts: string[] = [
        // 图片1：日杂风美食摄影
        `小红书爆款风格，${xhsTopic}，日杂美食杂志风，俯拍角度，食物造型精致，${xhsTopic}质感完美，莫兰迪色系背景，原木餐具，杂志排版感，阳光柔光，高级感，小红书博主风格`,
        // 图片2：韩系护肤品测评风
        `小红书风格${xhsTopic}，韩系护肤测评场景，${xhsTopic}作为主角，${xhsTopic}质感强，奶油肌妆效，韩式打光，白色大理石背景，小清新滤镜，韩妹同款，精致生活感`,
        // 图片3：胶片感旅行日记
        `小红书旅行风格${xhsTopic}，胶片感拍摄，${xhsTopic}与旅途结合，${xhsTopic}在旅途中，胶片颗粒感，复古色调，暖色光晕，旅行日记感，小众目的地，让人向往`,
        // 图片4：油画感艺术风格
        `小红书艺术风格${xhsTopic}，油画质感画面，${xhsTopic}融入古典油画构图，${xhsTopic}质感强，伦勃朗光，暖色调，复古边框，博物馆级质感，艺术感爆棚`,
        // 图片5：二次元动漫风格
        `小红书二次元风格${xhsTopic}，日系动漫插画风，${xhsTopic}作为主角，${xhsTopic}质感强，粉色蓝色系，圆润线条，梦幻滤镜，卡通渲染，二次元同好会风格`,
        // 图片6：杂志大片风格
        `小红书杂志风格${xhsTopic}，${xhsTopic}时尚大片感，高级灰调，${xhsTopic}质感强，杂志封面构图，专业灯光，商业摄影，大牌质感，都市丽人风，精致生活`,
        // 图片7：中式国潮风格
        `小红书国潮风格${xhsTopic}，${xhsTopic}融入中式美学，${xhsTopic}质感强，朱红金色配色，${xhsTopic}质感强，中国风元素，${xhsTopic}质感强，国风韵味，复古东方美`,
        // 图片8：手绘插画风格
        `小红书插画风格${xhsTopic}，${xhsTopic}手绘插画风，扁平化设计，${xhsTopic}质感强，马卡龙配色，圆润可爱风格，手帐感插画，温馨治愈感，小红书手帐博主风格`
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

      // 生成配图 - 每张图片画面风格完全不同，都围绕需求主题，适合推广分享
      const imageCount = Math.min(params.image_count || 1, 9)
      const topic = params.topic || '生活分享'
      
      // 核心：每张图片的画面风格完全不同，确保AI生成差异巨大的图片
      const imagePrompts = [
        // 图片1：黑白复古风格
        `朋友圈风格摄影，${topic}，复古黑白胶片质感，老式相机拍摄，高对比度黑白，长曝光，街拍风格，人物剪影，1950年代电影感，适合文艺青年`,
        // 图片2：赛博朋克霓虹风格
        `朋友圈风格${topic}，赛博朋克霓虹风格，霓虹灯闪烁，未来城市背景，青色和品红色调，蓝色紫色光污染，科幻感，蒸汽朋克元素，适合追求潮流`,
        // 图片3：日式小清新治愈系
        `朋友圈种草风格${topic}，日式小清新治愈系，柔和的粉彩色调，樱花树下，日系滤镜，逆光拍摄，梦幻模糊边缘，散文诗般的意境，适合文艺少女`,
        // 图片4：美式复古广告风格
        `朋友圈分享风格${topic}，美式复古广告风格，1950年代怀旧色调，鲜艳的红黄蓝配色，漫画风格，复古字体设计，波普艺术，适合个性表达`,
        // 图片5：韩系杂志封面风格
        `朋友圈风格${topic}，韩系杂志封面风格，高级灰调，莫兰迪色系，大片留白，模特造型感，韩风滤镜，商业摄影质感，适合都市白领`,
        // 图片6：电影感叙事风格
        `朋友圈风格${topic}，电影感叙事风格，宽幅构图，戏剧性光线，深焦拍摄，故事性场景，电影色调，适合有深度的内容`,
        // 图片7：极简主义艺术风格
        `朋友圈风格${topic}，极简主义艺术风格，大量留白，单一主体，纯色背景，几何构图，艺术装置感，高级感，适合品质生活`,
        // 图片8：复古宝丽来即时拍风格
        `朋友圈风格${topic}，宝丽来即时拍风格，白边相框，褪色复古色调，颗粒质感，手持拍摄，温馨怀旧，适合记录生活`
      ].slice(0, imageCount)

      const imageUrls: string[] = []
      try {
        const imageClient = new ImageGenerationClient(config)

        for (let i = 0; i < imagePrompts.length; i++) {
          const promptText = imagePrompts[i]
          // 添加唯一标识确保每次生成都不同
          const uniqueId = `${i + 1}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const uniquePrompt = `${promptText} [图片序号: ${i + 1}, 唯一ID: ${uniqueId}]`
          console.log(`生成朋友圈配图[${i + 1}], prompt: ${uniquePrompt}`)
          try {
            const imgResponse = await imageClient.generate({
              prompt: uniquePrompt,
              size: '1K',
              watermark: false
            })
            const helper = imageClient.getResponseHelper(imgResponse)
            console.log(`朋友圈配图[${i + 1}]生成结果, success: ${helper.success}, urls: ${JSON.stringify(helper.imageUrls)}`)
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
