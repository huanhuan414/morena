import { Injectable, Inject, forwardRef } from '@nestjs/common'
import { LLMClient, Config, HeaderUtils, S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { AgentService } from '../agent/agent.service'
import { LearningService } from '../avatar/learning.service'

@Injectable()
export class ChatService {
  private storage: S3Storage

  constructor(
    @Inject(forwardRef(() => AgentService)) private readonly agentService: AgentService,
    private readonly learningService: LearningService
  ) {
    // 初始化火山引擎CDN存储
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morena-ai',
      region: 'cn-guangzhou',
    })
  }

  async createConversation(userId: string, avatarId: string, title?: string) {
    const client = getSupabaseClient()

    // 验证 avatarId 是否存在
    if (!avatarId) {
      avatarId = 'default-avatar'
    }

    // 验证分身是否存在
    const { data: avatar, error: avatarError } = await client
      .from('avatars')
      .select('id')
      .eq('id', avatarId)
      .maybeSingle()

    if (avatarError || !avatar) {
      console.warn(`分身 ${avatarId} 不存在，使用默认处理`)
    }

    const { data: existingUser, error: userError } = await client
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (userError || !existingUser) {
      await client
        .from('users')
        .insert({
          id: userId,
          openid: `mock_openid_${userId}`,
          nickname: userId ? `用户${userId.slice(-4)}` : '测试用户',
          avatar: '',
          level: 1,
          exp: 0,
          credits: 0
        })
    }

    const { data, error } = await client
      .from('conversations')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        title: title || '新对话',
        context: [],
        updated_at: new Date().toISOString()
      })
      .select()
      .maybeSingle()

    if (error) {
      // 如果是外键约束错误，使用 NULL
      if (error.message.includes('foreign key constraint')) {
        const { data: newData, error: newError } = await client
          .from('conversations')
          .insert({
            user_id: userId,
            avatar_id: null,
            title: title || '新对话',
            context: [],
            updated_at: new Date().toISOString()
          })
          .select()
          .maybeSingle()

        if (newError) {
          throw new Error(`创建对话失败: ${newError.message}`)
        }
        return newData
      }
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

  async getConversationMessages(conversationId: string, limit: number = 20, before?: string) {
    const client = getSupabaseClient()

    let query = client
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(limit)

    // 如果有 before 参数，获取该消息之前的消息
    if (before) {
      const { data: beforeMsg } = await client
        .from('messages')
        .select('created_at')
        .eq('id', before)
        .single()

      if (beforeMsg) {
        query = query.lt('created_at', beforeMsg.created_at)
      }
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`获取消息失败: ${error.message}`)
    }

    // 反转顺序，使其按时间正序排列
    const messages = (data || []).reverse()

    // 处理消息中的媒体URL，生成签名链接并转换为 media 数组格式
    const processedMessages = await Promise.all(
      messages.map(async (msg) => {
        let mediaUrls: Record<string, string> = {}

        // 调试日志：打印原始消息数据
        if (msg.metadata?.media) {
          console.log('[ChatService getConversationMessages] 处理消息', msg.id, '原始 media:', JSON.stringify(msg.metadata.media))
        } else {
          console.log('[ChatService getConversationMessages] 处理消息', msg.id, '没有 media 字段')
        }

        // 处理 media_keys，生成签名链接
        if (msg.metadata?.media_keys) {
          const urls = await Promise.all(
            msg.metadata.media_keys.map(async (key: string) => {
              const url = await this.storage.generatePresignedUrl({ key, expireTime: 86400 })
              return { key, url }
            })
          )
          mediaUrls = urls.reduce((acc: any, { key, url }) => {
            acc[key] = url
            return acc
          }, {})
        }

        // 处理 metadata.media 数组，重新生成签名链接（解决视频链接过期问题）
        let mediaList: any[] = []

        if (msg.metadata?.media && Array.isArray(msg.metadata.media)) {
          console.log('[ChatService] 开始处理 media 数组，数量:', msg.metadata.media.length)
          if (msg.metadata.media.length === 0) {
            console.log('[ChatService] 警告：media 数组为空！')
          }

          mediaList = await Promise.all(
            msg.metadata.media.map(async (mediaItem: any) => {
              console.log('[ChatService] 处理 mediaItem:', JSON.stringify(mediaItem))

              // 如果 media 有 key，重新生成签名链接
              if (mediaItem.key) {
                try {
                  const newUrl = await this.storage.generatePresignedUrl({ key: mediaItem.key, expireTime: 86400 * 7 })
                  console.log('[ChatService] 重新生成签名链接成功:', mediaItem.key, '->', newUrl)
                  return {
                    ...mediaItem,
                    url: newUrl  // 使用新的签名链接替换旧链接
                  }
                } catch (error) {
                  console.error('[ChatService] 重新生成签名链接失败:', mediaItem.key, error)
                  return mediaItem  // 失败时返回原始数据
                }
              }

              console.log('[ChatService] mediaItem 没有 key，返回原始数据')
              // 如果没有 key 或提取失败，直接返回原始数据
              return mediaItem
            })
          )
          console.log('[ChatService] 处理完成，mediaList:', JSON.stringify(mediaList))
        } else {
          console.log('[ChatService] 没有找到 media 数组或不是数组')
        }

        // 转换 media_urls 为 media 数组格式（前端需要的格式）
        if (msg.metadata?.media_urls && typeof msg.metadata.media_urls === 'object' && mediaList.length === 0) {
          mediaList = Object.entries(msg.metadata.media_urls).map(([key, url]) => {
            // 根据文件扩展名判断类型
            const keyLower = key.toLowerCase()
            if (keyLower.includes('.mp4') || keyLower.includes('.mov') || keyLower.includes('.webm') || keyLower.includes('video')) {
              return { type: 'video', url, key }
            } else if (keyLower.includes('.jpg') || keyLower.includes('.jpeg') || keyLower.includes('.png') || keyLower.includes('.gif') || keyLower.includes('image')) {
              return { type: 'image', url, key }
            }
            return { type: 'image', url, key } // 默认为图片
          })
        }

        return {
          ...msg,
          metadata: {
            ...msg.metadata,
            media_urls: mediaUrls,
            media: mediaList
          }
        }
      })
    )

    console.log('[ChatService] 处理完成的消息列表:', processedMessages.map(m => ({
      id: m.id,
      role: m.role,
      hasAgentResult: !!m.metadata?.agent_result,
      agentResultStepsCount: m.metadata?.agent_result?.steps?.length || 0,
      hasMedia: !!m.metadata?.media,
      mediaCount: m.metadata?.media?.length || 0
    })))

    return processedMessages
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

    // 获取对话信息
    const { data: conversation } = await client
      .from('conversations')
      .select('context, title')
      .eq('id', conversationId)
      .single()

    // 检查是否是好友对话（通过对话标题判断）
    if (conversation?.title?.includes('与') && conversation?.title?.includes('的对话')) {
      // 从对话上下文中提取好友ID
      const friendId = (conversation.context as any)?.friend_id
      if (friendId) {
        // 检查是否被拉黑
        const { data: block } = await client
          .from('avatar_blocks')
          .select('id')
          .eq('avatar_id', avatarId)
          .eq('blocked_avatar_id', friendId)
          .single()

        if (block) {
          throw new Error('对方已将你拉黑，无法发送消息')
        }

        // 检查是否拉黑了对方
        const { data: selfBlock } = await client
          .from('avatar_blocks')
          .select('id')
          .eq('avatar_id', friendId)
          .eq('blocked_avatar_id', avatarId)
          .single()

        if (selfBlock) {
          throw new Error('你已拉黑对方，无法发送消息')
        }
      }
    }

    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()

    // 检查隐私模式
    const privacyMode = avatar?.config?.privacy_mode ?? false
    const userContent = privacyMode ? this.sanitizeMessage(content) : content
    
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userContent
    })
    
    const messages = [
      {
        role: 'system' as const,
        content: await this.buildSystemPrompt(avatar)
      },
      ...((conversation?.context || []) as any[]).slice(-10),
      { role: 'user' as const, content }
    ]
    
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
    const config = new Config()
    const llmClient = new LLMClient(config, customHeaders)
    
    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.8
    })
    
    // AI 回复也应用隐私脱敏
    const aiContent = privacyMode ? this.sanitizeMessage(response.content) : response.content
    
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: aiContent
    })
    
    const newContext = [
      ...((conversation?.context || []) as any[]).slice(-8),
      { role: 'user', content },
      { role: 'assistant', content: response.content }
    ]
    
    const updateData: any = {
      context: newContext,
      updated_at: new Date().toISOString()
    }
    
    if (conversation?.title === '新对话' || !conversation?.title) {
      const title = content.length <= 30 ? content : content.substring(0, 30) + '...'
      updateData.title = title
    }
    
    await client
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
    
    // 获取分身等级计算经验值
    const { data: avatarData } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()
    
    const chatExp = this.calculateChatExp(avatarData?.level || 1, content.length)
    await this.addAvatarExp(avatarId, chatExp)
    await this.updateAvatarLearning(avatarId, content, response.content, conversation?.context as string[])
    
    const taskInfo = this.detectTaskIntent(content, response.content)
    if (taskInfo && !response.content.includes('开始执行任务')) {
      await this.createTaskFromChat(userId, avatarId, taskInfo)
    }
    
    let taskId: string | undefined
    if (response.content.includes('开始执行任务')) {
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
   * 流式发送消息 - 支持实时状态反馈
   */
  async *sendMessageStream(
    conversationId: string,
    userId: string,
    avatarId: string,
    content: string,
    headers?: Record<string, string>
  ): AsyncGenerator<any> {
    const client = getSupabaseClient()
    
    // 发送开始状态
    yield { type: 'status', data: { stage: 'thinking', message: '正在思考...' } }
    
    const { data: conversation } = await client
      .from('conversations')
      .select('context, title')
      .eq('id', conversationId)
      .single()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    yield { type: 'status', data: { stage: 'processing', message: '处理请求中...' } }
    
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content
    })
    
    const messages = [
      {
        role: 'system' as const,
        content: await this.buildSystemPrompt(avatar)
      },
      ...((conversation?.context || []) as any[]).slice(-10),
      { role: 'user' as const, content }
    ]
    
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers as any) : undefined
    const config = new Config()
    const llmClient = new LLMClient(config, customHeaders)
    
    let fullResponse = ''
    yield { type: 'status', data: { stage: 'generating', message: '生成回复中...' } }
    
    try {
      const stream = llmClient.stream(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })
      
      for await (const chunk of stream) {
        if (chunk.content) {
          const text = chunk.content.toString()
          fullResponse += text
          yield { type: 'text', data: text }
        }
      }
    } catch (error) {
      console.error('LLM流式调用失败:', error)
      const response = await llmClient.invoke(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8
      })
      fullResponse = response.content
      yield { type: 'text', data: response.content }
    }
    
    // 检查是否需要执行任务
    if (fullResponse.includes('开始执行任务') || fullResponse.includes('正在处理')) {
      yield { type: 'status', data: { stage: 'task_start', message: '开始执行任务...' } }
      
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
        yield { type: 'task', data: { taskId: task.id, status: 'pending', progress: 0 } }
        
        // 执行任务并实时反馈
        try {
          for await (const update of this.executeTaskWithUpdates(task.id, userId, avatarId, content, headers)) {
            yield update
          }
        } catch (error) {
          yield { type: 'task_error', data: { message: '任务执行失败' } }
        }
      }
    }
    
    // 保存 AI 回复
    await client.from('messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: fullResponse
    })
    
    // 更新上下文
    const newContext = [
      ...((conversation?.context || []) as any[]).slice(-8),
      { role: 'user', content },
      { role: 'assistant', content: fullResponse }
    ]
    
    const updateData: any = {
      context: newContext,
      updated_at: new Date().toISOString()
    }
    
    if (conversation?.title === '新对话' || !conversation?.title) {
      const title = content.length <= 30 ? content : content.substring(0, 30) + '...'
      updateData.title = title
    }
    
    await client
      .from('conversations')
      .update(updateData)
      .eq('id', conversationId)
    
    // 获取分身等级计算经验值
    const { data: avatarData } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()
    
    const chatExp = this.calculateChatExp(avatarData?.level || 1, content.length)
    await this.addAvatarExp(avatarId, chatExp)
    await this.updateAvatarLearning(avatarId, content, fullResponse, conversation?.context as string[])
    
    yield { type: 'done', data: { message: '完成' } }
  }

  /**
   * 执行任务并生成实时更新
   */
  async *executeTaskWithUpdates(
    taskId: string,
    userId: string,
    avatarId: string,
    content: string,
    headers?: Record<string, string>
  ): AsyncGenerator<any> {
    const client = getSupabaseClient()
    
    yield { type: 'task', data: { taskId, status: 'running', progress: 10, message: '分析任务需求...' } }
    
    await client
      .from('tasks')
      .update({ status: 'running', progress: 10 })
      .eq('id', taskId)
    
    try {
      // 模拟任务执行阶段
      const stages = [
        { progress: 20, message: '规划执行步骤...' },
        { progress: 40, message: '调用AI能力处理...' },
        { progress: 60, message: '生成内容中...' },
        { progress: 80, message: '优化结果...' }
      ]
      
      for (const stage of stages) {
        await new Promise(resolve => setTimeout(resolve, 800))
        yield { type: 'task', data: { taskId, status: 'running', progress: stage.progress, message: stage.message } }
        
        await client
          .from('tasks')
          .update({ progress: stage.progress })
          .eq('id', taskId)
      }
      
      // 检测任务类型并生成相应内容
      const taskLower = content.toLowerCase()
      let result: any = { type: 'text', content: '任务已完成' }
      let mediaKeys: string[] = []
      
      // 生成图片任务
      if (taskLower.includes('画') || taskLower.includes('生成图片') || taskLower.includes('设计')) {
        yield { type: 'task', data: { taskId, status: 'running', progress: 85, message: '正在生成图片...' } }
        
        // 这里调用图片生成API，然后上传到CDN
        // 示例：模拟生成图片并上传
        const imageBuffer = Buffer.from('模拟图片数据')
        const imageKey = await this.storage.uploadFile({
          fileContent: imageBuffer,
          fileName: `generated/${taskId}/image_${Date.now()}.png`,
          contentType: 'image/png'
        })
        mediaKeys.push(imageKey)
        
        const imageUrl = await this.storage.generatePresignedUrl({ key: imageKey, expireTime: 86400 })
        
        result = {
          type: 'image',
          url: imageUrl,
          key: imageKey
        }
        
        yield { 
          type: 'media', 
          data: { 
            type: 'image', 
            url: imageUrl,
            key: imageKey
          } 
        }
      }
      
      // 生成视频任务
      if (taskLower.includes('视频') || taskLower.includes('短片')) {
        yield { type: 'task', data: { taskId, status: 'running', progress: 85, message: '正在生成视频...' } }
        
        // 这里调用视频生成API，然后上传到CDN
        // 示例：模拟生成视频并上传
        const videoBuffer = Buffer.from('模拟视频数据')
        const videoKey = await this.storage.uploadFile({
          fileContent: videoBuffer,
          fileName: `generated/${taskId}/video_${Date.now()}.mp4`,
          contentType: 'video/mp4'
        })
        mediaKeys.push(videoKey)
        
        const videoUrl = await this.storage.generatePresignedUrl({ key: videoKey, expireTime: 86400 })
        
        result = {
          type: 'video',
          url: videoUrl,
          key: videoKey
        }
        
        yield { 
          type: 'media', 
          data: { 
            type: 'video', 
            url: videoUrl,
            key: videoKey
          } 
        }
      }
      
      // 生成文章任务
      if (taskLower.includes('文章') || taskLower.includes('写') || taskLower.includes('创作')) {
        yield { type: 'task', data: { taskId, status: 'running', progress: 85, message: '正在撰写文章...' } }
        
        // 生成文章内容
        const articleContent = `# ${content}\n\n这是一篇由AI生成的文章...\n\n## 主要内容\n\n文章正文内容...`
        
        result = {
          type: 'article',
          content: articleContent,
          title: content
        }
        
        yield { 
          type: 'media', 
          data: { 
            type: 'article', 
            content: articleContent,
            title: content
          } 
        }
      }
      
      // 更新任务状态为完成
      await client
        .from('tasks')
        .update({
          status: 'completed',
          progress: 100,
          result,
          completed_at: new Date().toISOString()
        })
        .eq('id', taskId)
      
      yield { type: 'task', data: { taskId, status: 'completed', progress: 100, result } }
      
    } catch (error) {
      console.error('任务执行失败:', error)
      
      await client
        .from('tasks')
        .update({
          status: 'failed',
          result: { error: error.message }
        })
        .eq('id', taskId)
      
      yield { type: 'task_error', data: { taskId, message: error.message } }
    }
  }

  private async buildSystemPrompt(avatar: any): Promise<string> {
    // 使用 LearningService 构建个性化提示词
    return this.learningService.buildPersonalizedPrompt(avatar.id, avatar)
  }

  /**
   * 计算对话获得的经验值
   * 规则：
   * - 基础经验：根据等级递增
   * - 消息长度加成：超过50字获得额外经验
   * - 深度对话加成：超过200字获得更多经验
   */
  private calculateChatExp(level: number, messageLength: number): number {
    // 基础经验：Lv.1-5 每次 5-15 XP，Lv.6-10 每次 20-40 XP
    let baseExp: number
    if (level <= 5) {
      baseExp = 5 + (level - 1) * 2  // Lv.1:5, Lv.2:7, Lv.3:9, Lv.4:11, Lv.5:13
    } else {
      baseExp = 15 + (level - 5) * 5  // Lv.6:20, Lv.7:25, Lv.8:30, Lv.9:35, Lv.10:40
    }
    
    // 消息长度加成
    let lengthBonus = 0
    if (messageLength >= 200) {
      lengthBonus = Math.floor(messageLength / 100)  // 超过200字，每100字 +1
    } else if (messageLength >= 50) {
      lengthBonus = 1  // 超过50字 +1
    }
    
    return baseExp + lengthBonus
  }

  private async addAvatarExp(avatarId: string, exp: number) {
    const client = getSupabaseClient()

    const { data: avatar } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()

    if (avatar) {
      const newExp = (avatar.exp || 0) + exp
      // 🔴 修复：添加最大等级限制（Lv.10）
      const calculatedLevel = Math.floor(newExp / 100) + 1
      const newLevel = Math.min(calculatedLevel, 10) // 最高等级为 Lv.10

      // 如果已达到最高等级，只更新经验值，不更新等级
      const updateData: { exp: number; level?: number } = { exp: newExp }
      if (newLevel > (avatar.level || 1)) {
        updateData.level = newLevel
      }

      await client
        .from('avatars')
        .update(updateData)
        .eq('id', avatarId)
    }
  }

  private async updateAvatarLearning(avatarId: string, userMessage: string, aiMessage: string, conversationContext?: string[]) {
    // 使用 LearningService 进行深度学习分析
    const client = getSupabaseClient()
    const { data: { user } } = await client.auth.getUser()
    const userId = user?.id || 'anonymous'
    
    await this.learningService.analyzeAndUpdate(
      avatarId,
      userId,
      userMessage,
      aiMessage,
      conversationContext
    )
  }

  private detectTaskIntent(userMessage: string, aiResponse: string): any {
    const message = userMessage.toLowerCase()
    
    if (message.includes('提醒我') || message.includes('提醒')) {
      return { type: 'reminder', content: userMessage }
    }
    
    if (message.includes('安排') || message.includes('计划')) {
      return { type: 'schedule', content: userMessage }
    }
    
    return null
  }

  /**
   * 隐私脱敏处理
   * 对敏感信息进行脱敏，如手机号、身份证号、银行卡号等
   */
  private sanitizeMessage(content: string): string {
    if (!content) return content
    
    let sanitized = content
    
    // 手机号脱敏：保留前3位和后4位
    sanitized = sanitized.replace(/1[3-9]\d{9}/g, (match) => {
      return match.slice(0, 3) + '****' + match.slice(-4)
    })
    
    // 身份证号脱敏：保留前6位和后4位
    sanitized = sanitized.replace(/\d{17}[\dXx]/g, (match) => {
      return match.slice(0, 6) + '********' + match.slice(-4)
    })
    
    // 银行卡号脱敏：保留前4位和后4位
    sanitized = sanitized.replace(/\d{16,19}/g, (match) => {
      if (match.length >= 16) {
        return match.slice(0, 4) + '****' + match.slice(-4)
      }
      return match
    })
    
    // 邮箱脱敏：保留前2位和@后的域名
    sanitized = sanitized.replace(/[\w.-]+@[\w.-]+\.\w+/g, (match) => {
      const [localPart, domain] = match.split('@')
      if (localPart.length > 2) {
        return localPart.slice(0, 2) + '***@' + domain
      }
      return match
    })
    
    return sanitized
  }

  private async createTaskFromChat(userId: string, avatarId: string, taskInfo: any) {
    const client = getSupabaseClient()
    
    await client.from('tasks').insert({
      user_id: userId,
      avatar_id: avatarId,
      title: taskInfo.content.substring(0, 100),
      description: taskInfo.content,
      type: taskInfo.type,
      status: 'pending',
      progress: 0
    })
  }

  private async executeAgentTaskWithTaskId(
    taskId: string,
    userId: string,
    avatarId: string,
    conversationId: string,
    content: string,
    headers?: Record<string, string>
  ) {
    // 使用流式执行
    for await (const _ of this.executeTaskWithUpdates(taskId, userId, avatarId, content, headers)) {
      // 流式更新已通过 SSE 推送
    }
  }

  async deleteConversation(conversationId: string, userId: string) {
    const client = getSupabaseClient()

    await client
      .from('conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId)
  }

  /**
   * 直接调用LLM生成内容
   * 不需要创建对话，直接返回生成的文本
   */
  async generateContent(prompt: string): Promise<string> {
    const messages = [
      {
        role: 'system' as const,
        content: '你是一个专业的AI助手，擅长根据用户的输入生成高质量的内容。请根据用户的提示词生成准确、有用的内容。'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ]

    const config = new Config()
    const llmClient = new LLMClient(config)

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.8
    })

    return response.content
  }

}
