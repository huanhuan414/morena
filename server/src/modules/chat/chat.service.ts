import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { AgentService } from '../agent/agent.service'

@Injectable()
export class ChatService {
  constructor(
    @Inject(forwardRef(() => AgentService)) private readonly agentService: AgentService
  ) {}
  async createConversation(userId: string, avatarId: string, title?: string) {
    const client = getSupabaseClient()
    
    // 确保用户存在，如果不存在则自动创建
    const { data: existingUser, error: userError } = await client
      .from('users')
      .select('id')
      .eq('id', userId)
      .single()
    
    // 如果用户不存在，先创建用户
    if (userError || !existingUser) {
      console.log('用户不存在，自动创建用户:', userId)
      const { error: createError } = await client
        .from('users')
        .insert({
          id: userId,
          openid: `mock_openid_${userId}`,
          nickname: `用户${userId.slice(-4)}`,
          avatar: '',
          level: 1,
          exp: 0,
          credits: 0
        })
      
      if (createError) {
        console.error('创建用户失败:', createError.message)
      }
    }
    
    const { data, error } = await client
      .from('conversations')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        title: title || '新对话',
        context: []
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建对话失败: ${error.message}`)
    }
    
    return data
  }

  async getConversations(userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('conversations')
      .select('*, avatars(name, avatar_url)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取对话列表失败: ${error.message}`)
    }
    
    return data
  }

  async getConversationMessages(conversationId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    
    if (error) {
      throw new Error(`获取消息失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 发送消息并获取AI回复（非流式）
   */
  async sendMessage(
    conversationId: string,
    userId: string,
    avatarId: string,
    content: string,
    headers?: Record<string, string>
  ) {
    const client = getSupabaseClient()
    
    // 获取对话上下文
    const { data: conversation } = await client
      .from('conversations')
      .select('context')
      .eq('id', conversationId)
      .single()
    
    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    // 保存用户消息
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content
    })
    
    // 构建 AI 消息历史
    const messages = [
      {
        role: 'system' as const,
        content: this.buildSystemPrompt(avatar)
      },
      ...((conversation?.context || []) as any[]).slice(-10),
      { role: 'user' as const, content }
    ]
    
    // 调用 LLM
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
    const config = new Config()
    const llmClient = new LLMClient(config, customHeaders)
    
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.8
    })
    
    // 保存 AI 回复
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: response.content
    })
    
    // 更新对话上下文
    const newContext = [
      ...((conversation?.context || []) as any[]).slice(-8),
      { role: 'user', content },
      { role: 'assistant', content: response.content }
    ]
    
    await client
      .from('conversations')
      .update({
        context: newContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
    
    // 增加分身经验
    await this.addAvatarExp(avatarId, 1)
    
    // 更新分身学习数据
    await this.updateAvatarLearning(avatarId, content, response.content)
    
    // 检查是否需要创建简单任务（提醒类）
    const taskInfo = this.detectTaskIntent(content, response.content)
    if (taskInfo && !response.content.includes('开始执行任务')) {
      await this.createTaskFromChat(userId, avatarId, taskInfo)
    }
    
    // 检查是否需要执行复杂任务（Agent 执行）
    let taskId: string | undefined
    if (response.content.includes('开始执行任务')) {
      // 创建任务记录并返回 taskId
      const { data: task } = await client
        .from('tasks')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          title: `🤖 ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`,
          description: content,
          task_type: 'agent',
          priority: 'high',
          status: 'pending',
          progress: 0,
          params: { source: 'chat_agent' },
          result: {},
          logs: []
        })
        .select()
        .single()
      
      if (task) {
        taskId = task.id
        // 异步执行任务，不阻塞响应
        this.executeAgentTaskWithTaskId(task.id, userId, avatarId, conversationId, content, headers)
          .catch(err => console.error('Agent 任务执行失败:', err))
      }
    }
    
    return {
      role: 'assistant',
      content: response.content,
      taskId
    }
  }

  /**
   * 流式发送消息
   * 返回 AsyncGenerator 用于流式输出
   */
  async *sendMessageStream(
    conversationId: string,
    userId: string,
    avatarId: string,
    content: string,
    headers?: Record<string, string>
  ): AsyncGenerator<string> {
    const client = getSupabaseClient()
    
    // 获取对话上下文
    const { data: conversation } = await client
      .from('conversations')
      .select('context')
      .eq('id', conversationId)
      .single()
    
    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    // 保存用户消息
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content
    })
    
    // 构建 AI 消息历史
    const messages = [
      {
        role: 'system' as const,
        content: this.buildSystemPrompt(avatar)
      },
      ...((conversation?.context || []) as any[]).slice(-10),
      { role: 'user' as const, content }
    ]
    
    // 调用 LLM 流式接口
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
    const config = new Config()
    const llmClient = new LLMClient(config, customHeaders)
    
    let fullResponse = ''
    
    try {
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })
      
      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString()
          fullResponse += text
          yield text
        }
      }
    } catch (error) {
      console.error('LLM流式调用失败:', error)
      // 如果流式失败，尝试非流式
      const response = await llmClient.invoke(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })
      fullResponse = response.content
      yield response.content
    }
    
    // 保存 AI 回复
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse
    })
    
    // 更新对话上下文
    const newContext = [
      ...((conversation?.context || []) as any[]).slice(-8),
      { role: 'user', content },
      { role: 'assistant', content: fullResponse }
    ]
    
    await client
      .from('conversations')
      .update({
        context: newContext,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId)
    
    // 增加分身经验
    await this.addAvatarExp(avatarId, 1)
    
    // 更新分身学习数据
    await this.updateAvatarLearning(avatarId, content, fullResponse)
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(avatar: any) {
    const skills = Array.isArray(avatar.skills) ? avatar.skills.join('、') : '通用对话'
    const style = avatar.config?.style || 'tech'
    const photoAnalysis = avatar.config?.photo_analysis
    
    let styleDesc = ''
    switch (style) {
      case 'warm':
        styleDesc = '温暖亲和、善解人意'
        break
      case 'mysterious':
        styleDesc = '深邃神秘、富有哲理'
        break
      default:
        styleDesc = '理性专业、高效简洁'
    }
    
    let personalityDesc = ''
    if (photoAnalysis?.traits?.length > 0) {
      personalityDesc = `\n\n根据对用户照片的分析，你具有以下特质：${photoAnalysis.traits.join('、')}。`
    }
    
    return `你是${avatar.name}，一个AI分身，拥有自主执行任务的能力。

## 关于你
- 描述：${avatar.description || '我是一个友好、乐于助人的AI分身'}
- 性格：${avatar.personality || '友善、专业、有耐心'}
- 技能：${skills}
- 等级：Lv.${avatar.level}
- 风格：${styleDesc}
${personalityDesc}

## 你的核心能力

### 1. 智能对话
- 回答问题和提供信息
- 情感陪伴和聊天
- 创作内容（文章、文案、创意等）

### 2. 自主任务执行（核心能力！）
你拥有真正的任务执行能力，可以：
- 🔍 搜索互联网获取实时信息
- 📄 创建文档和报告
- 💬 发送消息通知用户
- 📊 查询和分析用户数据

当用户需要你执行复杂任务时，请回复：
【开始执行任务】
🎯 任务目标：[描述任务]
🔄 执行状态：正在进行中...

然后系统会自动帮你执行任务。

### 示例场景：
用户说：帮我搜索最新的AI新闻并整理成报告
你应该回复：
【开始执行任务】
🎯 任务目标：搜索最新AI新闻并整理报告
🔄 执行状态：正在进行中...

### 3. 简单提醒任务
对于简单的提醒，回复格式：
【任务已创建】
📋 任务：[任务内容]
⏰ 时间：[时间]
🎯 优先级：[高/中/低]

## 交互原则
1. 保持友善、专业的态度
2. 主动识别用户是否需要执行任务
3. 复杂任务使用"开始执行任务"触发自动执行
4. 简单提醒使用"任务已创建"格式
5. 展现出你是"活"的AI分身

## 特殊指令
当用户发送的任务涉及时间时，尝试提取：
- 任务标题
- 截止时间/提醒时间
- 优先级（高/中/低）
- 任务类型（提醒/待办/学习/工作等）`
  }

  /**
   * 更新分身学习数据
   * 分析用户消息，提取说话特征
   */
  private async updateAvatarLearning(avatarId: string, userMessage: string, aiResponse: string) {
    const client = getSupabaseClient()
    
    try {
      // 获取当前学习数据
      const { data: avatar } = await client
        .from('avatars')
        .select('config')
        .eq('id', avatarId)
        .single()
      
      const config = avatar?.config || {}
      const learning = config.learning || {
        messageCount: 0,
        avgMessageLength: 0,
        commonPhrases: [],
        emotions: [],
        topics: [],
      }
      
      // 更新消息计数
      learning.messageCount = (learning.messageCount || 0) + 1
      
      // 更新平均消息长度
      const prevTotal = (learning.avgMessageLength || 0) * (learning.messageCount - 1)
      learning.avgMessageLength = (prevTotal + userMessage.length) / learning.messageCount
      
      // 提取常用短语（简单的表情符号和口头禅检测）
      const emojis = userMessage.match(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu)
      if (emojis && emojis.length > 0) {
        learning.commonPhrases = [...new Set([...(learning.commonPhrases || []), ...emojis])].slice(0, 20)
      }
      
      // 更新配置
      await client
        .from('avatars')
        .update({
          config: {
            ...config,
            learning,
            lastInteraction: new Date().toISOString()
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', avatarId)
    } catch (error) {
      console.error('更新学习数据失败:', error)
    }
  }

  private async addAvatarExp(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      const newExp = avatar.exp + exp
      const newLevel = Math.floor(newExp / 100) + 1
      
      await client
        .from('avatars')
        .update({ exp: newExp, level: newLevel })
        .eq('id', avatarId)
    }
  }

  /**
   * 检测任务意图
   * 分析用户消息和AI回复，判断是否需要创建任务
   */
  private detectTaskIntent(userMessage: string, aiResponse: string): { title: string; time?: string; priority?: string } | null {
    // 任务关键词
    const taskKeywords = ['提醒', '记得', '帮我', '帮我做', '安排', '计划', '任务', '待办']
    const timeKeywords = ['明天', '后天', '下周', '周末', '今晚', '早上', '下午', '晚上', '几点']
    
    // 检查用户消息是否包含任务关键词
    const hasTaskIntent = taskKeywords.some(kw => userMessage.includes(kw))
    const hasTimeInfo = timeKeywords.some(kw => userMessage.includes(kw))
    
    // 检查AI是否确认了任务
    const aiConfirmedTask = aiResponse.includes('任务已创建') || 
                            aiResponse.includes('我会提醒') ||
                            aiResponse.includes('好的，我会')
    
    if (hasTaskIntent && (hasTimeInfo || aiConfirmedTask)) {
      // 提取时间信息
      let time: string | undefined
      const timeMatch = userMessage.match(/(明天|后天|下周|今晚|早上|下午|晚上)\s*(\d{1,2}[:点时]?\d{0,2})?/)
      if (timeMatch) {
        time = timeMatch[0]
      }
      
      // 提取优先级
      let priority: string = 'medium'
      if (userMessage.includes('紧急') || userMessage.includes('重要')) {
        priority = 'high'
      } else if (userMessage.includes('不急') || userMessage.includes('有空')) {
        priority = 'low'
      }
      
      // 提取任务标题（简化处理）
      let title = userMessage
        .replace(/(帮我|提醒我|记得|请|麻烦)/g, '')
        .replace(/(明天|后天|下周|今晚|早上|下午|晚上)\s*\d{0,2}[:点时]?\d{0,2}/g, '')
        .trim()
        .slice(0, 50)
      
      if (!title) {
        title = '新任务'
      }
      
      return { title, time, priority }
    }
    
    return null
  }

  /**
   * 从对话中创建任务
   */
  private async createTaskFromChat(
    userId: string,
    avatarId: string,
    taskInfo: { title: string; time?: string; priority?: string }
  ) {
    const client = getSupabaseClient()
    
    try {
      // 解析时间
      let dueDate: string | null = null
      if (taskInfo.time) {
        const now = new Date()
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
        
        if (taskInfo.time.includes('明天')) {
          dueDate = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString()
        } else if (taskInfo.time.includes('后天')) {
          dueDate = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString()
        } else if (taskInfo.time.includes('下周')) {
          dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
        } else if (taskInfo.time.includes('今晚')) {
          dueDate = new Date(today.getTime() + 20 * 60 * 60 * 1000).toISOString()
        }
      }
      
      const { data, error } = await client.from('tasks').insert({
        user_id: userId,
        avatar_id: avatarId,
        title: taskInfo.title,
        description: `从对话中自动创建: ${taskInfo.title}`,
        task_type: 'reminder',
        priority: taskInfo.priority || 'medium',
        status: 'pending',
        progress: 0,
        params: {
          due_date: dueDate,
          source: 'chat'
        },
        result: {},
        logs: []
      }).select().single()
      
      if (error) {
        console.error('创建任务失败:', error.message)
      } else {
        console.log('任务创建成功:', taskInfo.title, data?.id)
      }
    } catch (error) {
      console.error('创建任务失败:', error)
    }
  }

  /**
   * 执行 Agent 任务（异步）- 使用已创建的任务ID
   */
  private async executeAgentTaskWithTaskId(
    taskId: string,
    userId: string,
    avatarId: string,
    conversationId: string,
    userMessage: string,
    headers?: Record<string, string>
  ) {
    const client = getSupabaseClient()
    
    try {
      console.log('[AgentTask] 开始执行:', taskId)
      
      // 更新任务状态为执行中
      await client
        .from('tasks')
        .update({ status: 'executing' })
        .eq('id', taskId)
      
      // 直接调用 Agent 服务执行任务
      const result = await this.agentService.executeTask(
        taskId,
        userId,
        avatarId,
        conversationId,
        userMessage,
        headers
      )
      
      console.log('[AgentTask] 执行结果:', result)
      
      // 发送完成通知
      if (result.success && result.finalAnswer) {
        await client.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: `✅ 任务执行完成！\n\n${result.finalAnswer}\n\n执行用时: ${Math.round(result.duration / 1000)}秒\n使用工具: ${result.toolsUsed?.join(', ') || '无'}`
        })
      } else if (result.error) {
        await client.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: `❌ 任务执行失败: ${result.error}`
        })
      }
      
    } catch (error) {
      console.error('[AgentTask] 执行失败:', error)
    }
  }

  /**
   * 执行 Agent 任务（异步）
   */
  private async executeAgentTask(
    userId: string,
    avatarId: string,
    conversationId: string,
    userMessage: string,
    headers?: Record<string, string>
  ) {
    const client = getSupabaseClient()
    
    try {
      // 创建任务记录
      const { data: task } = await client
        .from('tasks')
        .insert({
          user_id: userId,
          avatar_id: avatarId,
          title: `🤖 ${userMessage.substring(0, 50)}${userMessage.length > 50 ? '...' : ''}`,
          description: userMessage,
          task_type: 'agent',
          priority: 'high',
          status: 'executing',
          progress: 0,
          params: { source: 'chat_agent' },
          result: {},
          logs: []
        })
        .select()
        .single()
      
      if (!task) {
        console.error('创建 Agent 任务失败')
        return
      }
      
      console.log('[AgentTask] 开始执行:', task.id)
      
      // 直接调用 Agent 服务执行任务
      const result = await this.agentService.executeTask(
        task.id,
        userId,
        avatarId,
        conversationId,
        userMessage,
        headers
      )
      
      console.log('[AgentTask] 执行结果:', result)
      
      // 发送完成通知
      if (result.success && result.finalAnswer) {
        await client.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: `✅ 任务执行完成！\n\n${result.finalAnswer}\n\n执行用时: ${Math.round(result.duration / 1000)}秒\n使用工具: ${result.toolsUsed?.join(', ') || '无'}`
        })
      } else if (result.error) {
        await client.from('messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: `❌ 任务执行失败: ${result.error}`
        })
      }
      
    } catch (error) {
      console.error('[AgentTask] 执行失败:', error)
    }
  }

  async deleteConversation(conversationId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除对话失败: ${error.message}`)
    }
    
    return { success: true }
  }
}
