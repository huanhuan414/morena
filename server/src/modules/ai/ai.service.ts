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

  /**
   * 直接调用火山引擎 ARK Responses API（豆包大模型）
   * API 文档: https://www.volcengine.com/docs/82379/1399202
   */
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
      this.logger.log('调用火山引擎豆包API生成内容...')

      const response = await fetch(`${ARK_BASE_URL}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ARK_API_KEY}`,
        },
        body: JSON.stringify({
          model: ARK_MODEL,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: systemPrompt }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: prompt }],
            },
          ],
        }),
      })

      if (!response.ok) {
        const errText = await response.text()
        this.logger.error(`ARK API 请求失败: status=${response.status}, body=${errText}`)
        throw new Error(`ARK API 请求失败: ${response.status}`)
      }

      const result = await response.json() as any

      // 从 Responses API 返回格式中提取文本
      // output 是数组，找 type=message 的项，取 content[0].text
      const output = result?.output || []
      let fullContent = ''

      for (const item of output) {
        if (item.type === 'message' && item.role === 'assistant') {
          const content = item.content || []
          for (const c of content) {
            if (c.type === 'output_text' && c.text) {
              fullContent += c.text
            }
          }
        }
      }

      if (!fullContent) {
        throw new Error('模型返回内容为空')
      }

      this.logger.log(`内容生成成功, 长度: ${fullContent.length}`)
      return { content: fullContent }
    } catch (error) {
      this.logger.error('内容生成失败:', error?.message || error)
      throw new Error(`内容生成失败: ${error.message}`)
    }
  }
}
