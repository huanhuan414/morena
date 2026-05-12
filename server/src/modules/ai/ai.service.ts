import { Injectable, Logger } from '@nestjs/common'
import { LLMClient, Config, Message } from 'coze-coding-dev-sdk'

type AiTaskStatus = 'processing' | 'completed' | 'failed'

type AiTask = {
  status: AiTaskStatus
  content?: string
  error?: string
  createdAt: number
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name)
  private readonly client: LLMClient
  private readonly tasks = new Map<string, AiTask>()

  constructor() {
    const config = new Config()
    this.client = new LLMClient(config)
  }

  startGenerate(params: { prompt: string; platforms: string[]; contentType: string }) {
    const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    this.tasks.set(requestId, { status: 'processing', createdAt: Date.now() })

    this.generateContent(params)
      .then((res) => {
        this.tasks.set(requestId, { status: 'completed', content: res.content, createdAt: Date.now() })
      })
      .catch((err: any) => {
        const msg = err?.message || '生成失败'
        this.tasks.set(requestId, { status: 'failed', error: msg, createdAt: Date.now() })
      })

    return { requestId, status: 'processing' as const }
  }

  getTask(requestId: string) {
    const task = this.tasks.get(requestId)
    if (!task) {
      return null
    }
    return {
      requestId,
      status: task.status,
      content: task.content,
      error: task.error,
    }
  }

  async generateContent(params: {
    prompt: string
    platforms: string[]
    contentType: string
  }): Promise<{ content: string }> {
    const { prompt, platforms, contentType } = params
    this.logger.log(
      `开始生成内容: promptLen=${prompt?.length || 0}, platforms=${platforms?.join(',') || ''}, contentType=${contentType || ''}`,
    )

    const systemPrompt =
      '你是一位资深内容策划与社交媒体运营专家，擅长为不同平台产出结构化、可执行、可落地的爆款内容任务描述。'

    try {
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
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
