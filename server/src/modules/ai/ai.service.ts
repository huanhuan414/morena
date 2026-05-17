import { Injectable, Logger } from '@nestjs/common'

// 火山引擎豆包 API 直连配置
const ARK_API_KEY = '0a6405d5-b7ae-4afa-88e3-c707ae379a47'
const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const ARK_MODEL = 'doubao-seed-2-0-pro-260215'

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
  private readonly tasks = new Map<string, AiTask>()

  startGenerate(params: { prompt: string; platforms: string[]; contentType: string }) {
    const requestId = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    this.tasks.set(requestId, { status: 'processing', content: '', createdAt: Date.now() })

    this.generateContentStreaming(params, requestId)
      .then((fullContent) => {
        this.tasks.set(requestId, { status: 'completed', content: fullContent, createdAt: Date.now() })
        this.logger.log(`AI帮写完成, 内容长度: ${fullContent.length}`)
      })
      .catch((err: any) => {
        const msg = err?.message || '生成失败'
        this.tasks.set(requestId, { status: 'failed', error: msg, createdAt: Date.now() })
        this.logger.error(`AI帮写失败: ${msg}`)
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

  /**
   * 使用 Chat Completions API + 流式响应
   * 优势：推理模型(doubao-seed)的思考过程不阻塞，内容产出后立即可读取
   */
  private async generateContentStreaming(
    params: { prompt: string; platforms: string[]; contentType: string },
    requestId: string,
  ): Promise<string> {
    const { prompt } = params

    const systemPrompt =
      '你是一位资深内容策划与社交媒体运营专家，擅长为不同平台产出结构化、可执行、可落地的爆款内容任务描述。'

    this.logger.log('调用火山引擎豆包API(流式)生成内容...')

    const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      this.logger.error(`ARK API 请求失败: status=${response.status}, body=${errText}`)
      throw new Error(`ARK API 请求失败: ${response.status}`)
    }

    // 解析 SSE 流式响应
    const reader = response.body?.getReader()
    if (!reader) {
      throw new Error('无法获取响应流')
    }

    const decoder = new TextDecoder()
    let fullContent = ''
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // 保留未完成的行

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue

        const dataStr = trimmed.slice(6)
        if (dataStr === '[DONE]') continue

        try {
          const chunk = JSON.parse(dataStr)
          const delta = chunk.choices?.[0]?.delta
          if (delta?.content) {
            fullContent += delta.content
            // 渐进式更新 task 内容，前端轮询即可看到部分内容
            const task = this.tasks.get(requestId)
            if (task && task.status === 'processing') {
              this.tasks.set(requestId, { ...task, content: fullContent })
            }
          }
          // reasoning_content 是思考过程，跳过不展示
        } catch {
          // 忽略解析失败的行
        }
      }
    }

    if (!fullContent) {
      throw new Error('模型返回内容为空')
    }

    return fullContent
  }

  /**
   * 同步调用 ARK Chat Completions API（非流式，用于 ContentGenerationService / SkillController）
   * 返回完整的助手回复文本
   */
  static async invokeLlmSync(messages: Array<{ role: string; content: string }>): Promise<string> {
    const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`ARK API 请求失败: ${response.status} - ${errText.slice(0, 200)}`)
    }

    const result = (await response.json()) as any
    const content = result?.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('模型返回内容为空')
    }

    return content
  }

  /**
   * 同步生成内容（用于 SkillController 等非流式调用场景）
   */
  async generateContent(params: {
    prompt: string
    platforms: string[]
    contentType: string
  }): Promise<{ content: string }> {
    const { prompt } = params
    const systemPrompt =
      '你是一位资深内容策划与社交媒体运营专家，擅长为不同平台产出结构化、可执行、可落地的爆款内容任务描述。'

    const content = await AiService.invokeLlmSync([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ])

    return { content }
  }
}
