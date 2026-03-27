import { Injectable } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { ToolsRegistry } from './tools.registry'
import { 
  ToolContext, 
  ToolExecutionContext,
  AgentStep, 
  AgentExecutionResult,
  ToolResult
} from './tools.interface'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class AgentService {
  private readonly MAX_STEPS = 10  // 最大执行步数

  constructor(private readonly toolsRegistry: ToolsRegistry) {}

  /**
   * 执行 Agent 任务
   * ReAct 风格：思考 -> 行动 -> 观察 -> 循环
   */
  async executeTask(
    taskId: string,
    userId: string,
    avatarId: string,
    conversationId: string,
    taskDescription: string,
    headers?: Record<string, string>
  ): Promise<AgentExecutionResult> {
    const startTime = Date.now()
    const steps: AgentStep[] = []
    const toolsUsed: string[] = []
    
    const context: ToolExecutionContext = {
      userId,
      avatarId,
      conversationId,
      taskId,
      headers
    }

    try {
      // 更新任务状态为执行中
      await this.updateTaskStatus(taskId, 'executing', 0)

      // 获取分身信息
      const avatar = await this.getAvatar(avatarId)
      const avatarName = avatar?.name || 'AI分身'

      // 初始化 LLM 客户端
      const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
      const config = new Config()
      const llmClient = new LLMClient(config, customHeaders)

      // 构建系统提示词
      const systemPrompt = this.buildAgentSystemPrompt(avatarName, taskDescription)
      
      // 执行循环
      let currentStep = 0
      let isComplete = false
      let finalAnswer = ''
      let messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请执行任务：${taskDescription}` }
      ]

      while (!isComplete && currentStep < this.MAX_STEPS) {
        currentStep++
        
        // 调用 LLM 获取下一步行动
        const response = await llmClient.invoke(messages, {
          model: 'doubao-seed-1-8-251228',
          temperature: 0.3
        })

        const aiResponse = response.content
        
        // 解析 AI 响应
        const parsed = this.parseAgentResponse(aiResponse)
        
        // 记录步骤
        const step: AgentStep = {
          step: currentStep,
          thought: parsed.thought || '',
          action: parsed.action || '',
          tool: parsed.tool,
          parameters: parsed.parameters,
          timestamp: new Date().toISOString()
        }

        // 检查是否完成
        if (parsed.isComplete) {
          isComplete = true
          finalAnswer = parsed.finalAnswer || aiResponse
          step.observation = '任务完成'
          steps.push(step)
          break
        }

        // 执行工具调用
        if (parsed.tool && parsed.parameters) {
          const toolResult: ToolResult = await this.toolsRegistry.executeTool(
            { tool: parsed.tool, parameters: parsed.parameters },
            context
          )
          
          step.result = toolResult
          step.observation = toolResult.message
          
          if (!toolsUsed.includes(parsed.tool)) {
            toolsUsed.push(parsed.tool)
          }

          // 更新进度
          const progress = Math.min(Math.round((currentStep / this.MAX_STEPS) * 100), 90)
          await this.updateTaskStatus(taskId, 'executing', progress)

          // 将结果添加到对话历史
          messages.push(
            { role: 'assistant', content: aiResponse },
            { 
              role: 'user', 
              content: `工具执行结果:\n${JSON.stringify(toolResult, null, 2)}\n\n请根据结果继续执行任务，或者如果任务已完成，请回复 "最终答案: [你的答案]"` 
            }
          )
        } else {
          // 没有工具调用，可能是 AI 需要更多信息或直接回答
          messages.push(
            { role: 'assistant', content: aiResponse },
            { role: 'user', content: '请继续执行任务。如果需要使用工具，请按照格式调用。如果任务已完成，请回复 "最终答案: [你的答案]"' }
          )
        }

        steps.push(step)
      }

      // 如果达到最大步数但未完成
      if (!isComplete) {
        finalAnswer = '任务执行达到最大步数限制，可能需要人工介入。'
      }

      // 更新任务状态
      await this.updateTaskStatus(taskId, 'completed', 100, finalAnswer)

      // 记录执行日志
      await this.saveExecutionLogs(taskId, steps)

      const duration = Date.now() - startTime

      return {
        success: true,
        steps,
        finalAnswer,
        toolsUsed,
        duration
      }
    } catch (error) {
      console.error('[AgentService] 执行失败:', error)
      
      await this.updateTaskStatus(taskId, 'failed', 0, error.message)
      
      return {
        success: false,
        steps,
        finalAnswer: `执行失败: ${error.message}`,
        toolsUsed,
        duration: Date.now() - startTime,
        error: error.message
      }
    }
  }

  /**
   * 解析 AI 响应，提取思考、行动和工具调用
   */
  private parseAgentResponse(response: string): {
    thought: string
    action: string
    tool?: string
    parameters?: any
    isComplete: boolean
    finalAnswer?: string
  } {
    const result = {
      thought: '',
      action: '',
      tool: undefined as string | undefined,
      parameters: undefined as any,
      isComplete: false,
      finalAnswer: undefined as string | undefined
    }

    // 检查是否完成任务
    const finalAnswerMatch = response.match(/最终答案[：:]\s*(.+)/s)
    if (finalAnswerMatch) {
      result.isComplete = true
      result.finalAnswer = finalAnswerMatch[1].trim()
      return result
    }

    // 提取思考过程
    const thoughtMatch = response.match(/思考[：:]\s*(.+?)(?=\n|$)/s)
    if (thoughtMatch) {
      result.thought = thoughtMatch[1].trim()
    }

    // 提取行动
    const actionMatch = response.match(/行动[：:]\s*(.+?)(?=\n|$)/s)
    if (actionMatch) {
      result.action = actionMatch[1].trim()
    }

    // 提取工具调用
    const toolMatch = response.match(/工具[：:]\s*(\w+)/)
    if (toolMatch) {
      result.tool = toolMatch[1].trim()
    }

    // 提取参数
    const paramsMatch = response.match(/参数[：:]\s*```json\s*([\s\S]*?)\s*```/)
    if (paramsMatch) {
      try {
        result.parameters = JSON.parse(paramsMatch[1].trim())
      } catch (e) {
        console.error('[AgentService] 参数解析失败:', e)
      }
    }

    // 尝试从 JSON 格式中提取
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch && !result.tool) {
      try {
        const parsed = JSON.parse(jsonMatch[1].trim())
        if (parsed.tool) {
          result.tool = parsed.tool
          result.parameters = parsed.parameters
        }
      } catch (e) {
        // 忽略解析错误
      }
    }

    return result
  }

  /**
   * 构建 Agent 系统提示词
   */
  private buildAgentSystemPrompt(avatarName: string, taskDescription: string): string {
    const tools = this.toolsRegistry.getToolsDefinition()
    
    const toolsDescription = tools.map(t => 
      `- ${t.name}: ${t.description}\n  参数: ${JSON.stringify(t.parameters, null, 2)}`
    ).join('\n\n')

    return `你是${avatarName}，一个拥有自主执行能力的 AI Agent。

## 当前任务
${taskDescription}

## 可用工具
${toolsDescription}

## 执行规范

你必须严格按照以下格式思考和行动：

思考: [分析当前情况，决定下一步要做什么]
行动: [描述你要执行的动作]
工具: [工具名称]
参数: 
\`\`\`json
{"参数名": "参数值"}
\`\`\`

或者当任务完成时：
最终答案: [任务的最终结果]

## 执行原则

1. **分步执行**：将复杂任务分解为多个小步骤
2. **使用工具**：当需要外部信息或执行操作时，调用合适的工具
3. **观察结果**：仔细分析工具返回的结果，决定下一步
4. **保持专注**：始终围绕任务目标，不要偏离
5. **及时反馈**：任务完成后，给出清晰的最终答案

## 示例

用户任务: 帮我搜索最新的 AI 新闻并整理成报告

思考: 需要先搜索 AI 相关的最新新闻
行动: 使用搜索工具获取最新 AI 新闻
工具: search
参数: 
\`\`\`json
{"query": "AI 人工智能 最新动态 2024", "count": 5}
\`\`\`

[获取结果后继续...]

思考: 已经获取到新闻内容，现在需要整理成报告
行动: 创建一份 AI 新闻报告文档
工具: create_document
参数: 
\`\`\`json
{"title": "AI 最新动态报告", "content": "# AI 最新动态\\n\\n...", "type": "report"}
\`\`\`

[文档创建成功]

最终答案: 已完成 AI 最新动态报告的搜索和整理，报告已保存。

现在，请开始执行任务。`
  }

  /**
   * 更新任务状态
   */
  private async updateTaskStatus(
    taskId: string, 
    status: string, 
    progress: number,
    result?: string
  ) {
    const client = getSupabaseClient()
    
    const updateData: any = {
      status,
      progress,
      updated_at: new Date().toISOString()
    }
    
    if (result) {
      updateData.result = { summary: result }
    }
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString()
    }
    
    await client
      .from('tasks')
      .update(updateData)
      .eq('id', taskId)
  }

  /**
   * 保存执行日志
   */
  private async saveExecutionLogs(taskId: string, steps: AgentStep[]) {
    const client = getSupabaseClient()
    
    const logs = steps.map(step => ({
      timestamp: step.timestamp,
      thought: step.thought,
      action: step.action,
      tool: step.tool,
      observation: step.observation,
      success: step.result?.success
    }))
    
    await client
      .from('tasks')
      .update({ logs })
      .eq('id', taskId)
  }

  /**
   * 获取分身信息
   */
  private async getAvatar(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    return data
  }
}
