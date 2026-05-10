import { Injectable, Logger } from '@nestjs/common'
import { LLMClient, Config, Message } from 'coze-coding-dev-sdk'

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly client: LLMClient

  constructor() {
    const config = new Config()
    this.client = new LLMClient(config)
  }

  async generateContent(params: {
    prompt: string
    platforms: string[]
    contentType: string
  }): Promise<{ content: string }> {
    this.logger.log('开始生成内容，参数:', JSON.stringify(params))

    const { prompt, platforms, contentType } = params

    // 构建平台信息
    const platformNames = platforms.map(p => {
      const names: Record<string, string> = {
        douyin: '抖音',
        xiaohongshu: '小红书',
        wechat_mp: '微信公众号',
        wechat_moments: '微信朋友圈',
        weibo: '微博',
        bilibili: 'B站',
        kuaishou: '快手'
      }
      return names[p] || p
    }).join('、')

    // 构建内容类型
    const contentTypeNames: Record<string, string> = {
      copywriting: '种草文案',
      video_script: '短视频脚本',
      poster_text: '海报文案',
      product_desc: '产品描述',
      review: '测评文案'
    }
    const contentTypeName = contentTypeNames[contentType] || contentType

    // 构建系统提示词
    const systemPrompt = `你是一位专业的社交媒体内容创作者，擅长撰写各平台的营销文案。请根据用户的需求生成高质量的内容。`

    // 构建用户提示词
    const userPrompt = `请为以下产品/主题创作内容：

【产品/主题】
${prompt}

【目标平台】
${platformNames}

【内容类型】
${contentTypeName}

【要求】
1. 内容要符合目标平台的风格和用户习惯
2. 语言生动有趣，吸引用户注意力
3. 突出产品亮点，但不要过于硬广
4. 适合达人/博主发布
5. 字数适中（${contentType === 'video_script' ? '60秒-120秒' : '200-500字'}）

请直接输出内容，不要加标题或说明文字。`

    try {
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]

      this.logger.log('调用豆包大模型生成内容...')

      // 使用 invoke 方法（非流式）
      const response = await this.client.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.8
      })

      this.logger.log('内容生成成功')
      return {
        content: response.content
      }
    } catch (error) {
      this.logger.error('内容生成失败:', error)
      throw new Error(`内容生成失败: ${error.message}`)
    }
  }
}
