import { Injectable, Logger, Optional } from '@nestjs/common'
import { CreateGroupDto, UpdateGroupStatusDto, CorrectMessageDto, WebhookPayloadDto, TriggerReplyDto } from './dto/group-bot.dto'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { FeishuService } from './feishu/feishu.service'

interface GroupBot {
  id: string
  userId: string
  avatarId: string
  groupName: string
  platform: 'wecom' | 'feishu'
  webhookUrl: string
  platformChatId?: string  // 飞书chatId或企业微信chatId
  status: 'active' | 'paused'
  lastActiveAt: string
  createdAt: string
}

interface GroupMessage {
  id: string
  groupBotId: string
  senderName: string
  content: string
  msgType: 'user' | 'avatar' | 'system'
  avatarReply: string | null
  userCorrection: string | null
  correctionDiff: string | null
  createdAt: string
}

@Injectable()
export class GroupBotService {
  private readonly logger = new Logger(GroupBotService.name)
  private groups: GroupBot[] = []
  private messages: GroupMessage[] = []
  private idCounter = 1
  private msgCounter = 1
  private feishuService: FeishuService | null = null

  constructor(
    @Optional() feishuService: FeishuService,
  ) {
    this.feishuService = feishuService
  }

  async createGroup(userId: string, dto: CreateGroupDto): Promise<GroupBot> {
    const group: GroupBot = {
      id: `gb_${this.idCounter++}`,
      userId,
      avatarId: dto.avatarId || '',
      groupName: dto.groupName,
      platform: dto.platform,
      webhookUrl: dto.webhookUrl,
      status: 'active',
      lastActiveAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
    this.groups.push(group)
    this.logger.log(`Created group bot: ${group.id} - ${group.groupName}`)
    return group
  }

  async getGroups(userId: string): Promise<GroupBot[]> {
    return this.groups.filter(g => g.userId === userId)
  }

  async getGroupById(id: string, userId: string): Promise<GroupBot | null> {
    const group = this.groups.find(g => g.id === id && g.userId === userId)
    return group || null
  }

  async updateGroupStatus(id: string, userId: string, dto: UpdateGroupStatusDto): Promise<GroupBot | null> {
    const group = await this.getGroupById(id, userId)
    if (!group) return null
    group.status = dto.status
    group.lastActiveAt = new Date().toISOString()
    return group
  }

  async deleteGroup(id: string, userId: string): Promise<boolean> {
    const idx = this.groups.findIndex(g => g.id === id && g.userId === userId)
    if (idx === -1) return false
    this.groups.splice(idx, 1)
    this.messages = this.messages.filter(m => m.groupBotId !== id)
    return true
  }

  async getMessages(groupBotId: string, userId: string, limit = 50): Promise<GroupMessage[]> {
    const group = this.groups.find(g => g.id === groupBotId && g.userId === userId)
    if (!group) return []
    return this.messages
      .filter(m => m.groupBotId === groupBotId)
      .slice(-limit)
  }

  async handleWebhook(payload: WebhookPayloadDto): Promise<GroupMessage> {
    const group = this.groups.find(g => g.webhookUrl.includes(payload.groupId) || g.id === payload.groupId)
    if (!group) {
      throw new Error(`Group not found for webhook: ${payload.groupId}`)
    }
    if (group.status !== 'active') {
      throw new Error(`Group bot is paused: ${group.id}`)
    }

    // Save user message
    const userMsg: GroupMessage = {
      id: `msg_${this.msgCounter++}`,
      groupBotId: group.id,
      senderName: payload.senderName || '未知用户',
      content: payload.content,
      msgType: 'user',
      avatarReply: null,
      userCorrection: null,
      correctionDiff: null,
      createdAt: new Date().toISOString(),
    }
    this.messages.push(userMsg)
    group.lastActiveAt = new Date().toISOString()

    return userMsg
  }

  async triggerAvatarReply(groupBotId: string, userId: string, dto: TriggerReplyDto): Promise<GroupMessage | null> {
    const group = await this.getGroupById(groupBotId, userId)
    if (!group) return null

    const userMsg = this.messages.find(m => m.id === dto.messageId)
    if (!userMsg) return null

    // Build context: last 10 messages
    const recentMessages = this.messages
      .filter(m => m.groupBotId === groupBotId)
      .slice(-10)

    const contextStr = recentMessages
      .map(m => `${m.msgType === 'user' ? m.senderName : '分身'}: ${m.content}`)
      .join('\n')

    // Call LLM with personality prompt
    const avatarReply = await this.generateAvatarReply(contextStr, userMsg.content, group)

    // Save avatar reply
    const replyMsg: GroupMessage = {
      id: `msg_${this.msgCounter++}`,
      groupBotId: group.id,
      senderName: '分身',
      content: avatarReply,
      msgType: 'avatar',
      avatarReply: avatarReply,
      userCorrection: null,
      correctionDiff: null,
      createdAt: new Date().toISOString(),
    }
    this.messages.push(replyMsg)
    group.lastActiveAt = new Date().toISOString()

    return replyMsg
  }

  async correctMessage(messageId: string, userId: string, dto: CorrectMessageDto): Promise<GroupMessage | null> {
    const msg = this.messages.find(m => m.id === messageId)
    if (!msg) return null

    // Verify the message belongs to a group owned by this user
    const group = this.groups.find(g => g.id === msg.groupBotId && g.userId === userId)
    if (!group) return null

    msg.userCorrection = dto.correction
    msg.correctionDiff = await this.extractDiff(msg.content, dto.correction)

    return msg
  }

  private async generateAvatarReply(context: string, userMessage: string, group: GroupBot): Promise<string> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const systemPrompt = `你是${group.groupName}群里的AI分身，代表群主回复消息。
你的回复风格要求：
1. 亲切自然，像朋友聊天一样
2. 先理解对方的需求，再给出建议
3. 不确定的事情要诚实说明
4. 不要使用焦虑营销话术
5. 不要做虚假承诺
6. 回复简洁，不超过100字

以下是群聊上下文：
${context}`

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `请回复这条消息：${userMessage}` },
      ]

      console.log(`[GroupBot] Generating reply for group: ${group.groupName}, message: ${userMessage}`)

      const response = await client.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.7,
      })

      console.log(`[GroupBot] Generated reply: ${response.content}`)
      return response.content
    } catch (error) {
      this.logger.error(`Failed to generate avatar reply: ${error.message}`, error.stack)
      return '抱歉，我现在无法回复，稍后再试。'
    }
  }

  /**
   * 企业微信消息回复（从企业微信回调触发）
   * fromUserName: 发送者企业微信UserID
   * content: 消息内容（已去掉@莫瑞娜部分）
   * chatId: 群聊ID（如果是群消息）
   */
  async generateWecomReply(fromUserName: string, content: string, chatId?: string): Promise<string> {
    // 去掉 @莫瑞娜 的部分
    const cleanContent = content.replace(/@莫瑞娜/g, '').trim()
    if (!cleanContent) {
      return '你好，有什么可以帮你的吗？'
    }

    // 查找对应的群（如果有的话）
    const group = chatId ? this.groups.find(g => g.webhookUrl.includes(chatId)) : null

    // 记录消息到内存
    if (group) {
      const userMsg: GroupMessage = {
        id: `msg_${this.msgCounter++}`,
        groupBotId: group.id,
        senderName: fromUserName,
        content: cleanContent,
        msgType: 'user',
        avatarReply: null,
        userCorrection: null,
        correctionDiff: null,
        createdAt: new Date().toISOString(),
      }
      this.messages.push(userMsg)
      group.lastActiveAt = new Date().toISOString()

      // Build context
      const recentMessages = this.messages
        .filter(m => m.groupBotId === group.id)
        .slice(-10)
      const contextStr = recentMessages
        .map(m => `${m.msgType === 'user' ? m.senderName : '分身'}: ${m.content}`)
        .join('\n')

      const reply = await this.generateAvatarReply(contextStr, cleanContent, group)

      // Save avatar reply
      const replyMsg: GroupMessage = {
        id: `msg_${this.msgCounter++}`,
        groupBotId: group.id,
        senderName: '分身',
        content: reply,
        msgType: 'avatar',
        avatarReply: reply,
        userCorrection: null,
        correctionDiff: null,
        createdAt: new Date().toISOString(),
      }
      this.messages.push(replyMsg)

      return reply
    }

    // 没有找到对应群，使用通用回复
    return this.generateGenericReply(fromUserName, cleanContent)
  }

  private async generateGenericReply(userName: string, message: string): Promise<string> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const systemPrompt = `你是莫瑞娜，一个AI分身助手。你代表用户回复消息。
你的回复风格要求：
1. 亲切自然，像朋友聊天一样
2. 先理解对方的需求，再给出建议
3. 不确定的事情要诚实说明
4. 不要使用焦虑营销话术
5. 不要做虚假承诺
6. 回复简洁，不超过100字`

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `用户${userName}说：${message}\n请以分身身份回复。` },
      ]

      console.log(`[GroupBot] Generating generic reply for wecom user: ${userName}, message: ${message}`)

      const response = await client.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.7,
      })

      console.log(`[GroupBot] Generated generic reply: ${response.content}`)
      return response.content
    } catch (error) {
      this.logger.error(`Failed to generate wecom reply: ${error.message}`, error.stack)
      return '抱歉，我现在无法回复，稍后再试。'
    }
  }

  /**
   * 飞书消息回复（从WebSocket长连接触发）
   * text: 消息内容
   * senderName: 发送者名称
   * avatarId: 分身ID（可选，为空则用默认风格）
   */
  async generateFeishuReply(text: string, senderName: string, avatarId: string | null): Promise<string | null> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const systemPrompt = avatarId
        ? `你是群里的AI分身（分身ID: ${avatarId}），代表群主回复消息。
你的回复风格要求：
1. 亲切自然，像朋友聊天一样
2. 先理解对方的需求，再给出建议
3. 不确定的事情要诚实说明
4. 不要使用焦虑营销话术
5. 不要做虚假承诺
6. 回复简洁，不超过100字`
        : `你是莫瑞娜，一个AI分身助手。你代表用户回复消息。
你的回复风格要求：
1. 亲切自然，像朋友聊天一样
2. 先理解对方的需求，再给出建议
3. 不确定的事情要诚实说明
4. 不要使用焦虑营销话术
5. 不要做虚假承诺
6. 回复简洁，不超过100字`

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: `用户${senderName}说：${text}\n请以分身身份回复。` },
      ]

      console.log(`[GroupBot] Generating feishu reply for: ${senderName}, message: ${text}`)

      const response = await client.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.7,
      })

      console.log(`[GroupBot] Generated feishu reply: ${response.content}`)
      return response.content
    } catch (error) {
      this.logger.error(`Failed to generate feishu reply: ${error.message}`, error.stack)
      return null
    }
  }

  /**
   * 记录飞书消息到本地
   */
  async recordFeishuMessage(groupBotId: string, senderName: string, userContent: string, avatarReply: string): Promise<void> {
    // 保存用户消息
    const userMsg: GroupMessage = {
      id: `msg_${this.msgCounter++}`,
      groupBotId,
      senderName,
      content: userContent,
      msgType: 'user',
      avatarReply: null,
      userCorrection: null,
      correctionDiff: null,
      createdAt: new Date().toISOString(),
    }
    this.messages.push(userMsg)

    // 保存分身回复
    const replyMsg: GroupMessage = {
      id: `msg_${this.msgCounter++}`,
      groupBotId,
      senderName: '分身',
      content: avatarReply,
      msgType: 'avatar',
      avatarReply: avatarReply,
      userCorrection: null,
      correctionDiff: null,
      createdAt: new Date().toISOString(),
    }
    this.messages.push(replyMsg)

    // 更新最后活跃时间
    const group = this.groups.find(g => g.id === groupBotId)
    if (group) {
      group.lastActiveAt = new Date().toISOString()
    }
  }

  /**
   * 根据平台chatId查找群配置
   */
  async findGroupByPlatformChatId(platform: 'wecom' | 'feishu', chatId: string): Promise<GroupBot | null> {
    const group = this.groups.find(g => g.platform === platform && g.webhookUrl === chatId)
    return group || null
  }

  /**
   * 更新群的飞书chatId
   */
  async updateGroupChatId(groupBotId: string, chatId: string): Promise<GroupBot | null> {
    const group = this.groups.find(g => g.id === groupBotId)
    if (!group) return null
    group.webhookUrl = chatId
    return group
  }

  private async extractDiff(original: string, correction: string): Promise<string> {
    try {
      const config = new Config()
      const client = new LLMClient(config)

      const messages = [
        {
          role: 'system' as const,
          content: '你是一个差异分析助手。对比分身原始回复和用户纠正后的回复，提炼出关键差异。用一句话描述用户纠正了什么偏好或底线。格式：\"偏好/底线：具体内容\"',
        },
        {
          role: 'user' as const,
          content: `分身原始回复：${original}\n用户纠正后：${correction}\n请提炼差异。`,
        },
      ]

      const response = await client.invoke(messages, {
        model: 'doubao-seed-2-0-mini-260215',
        temperature: 0.3,
      })

      return response.content
    } catch (error) {
      this.logger.error(`Failed to extract diff: ${error.message}`)
      return '差异分析失败'
    }
  }

  // ========== 飞书连接管理 ==========

  async startFeishuConnection(): Promise<void> {
    if (this.feishuService) {
      await this.feishuService.startWebSocket()
    } else {
      throw new Error('飞书服务未配置')
    }
  }

  stopFeishuConnection(): void {
    // WebSocket断开通过服务销毁实现
  }

  getFeishuStatus(): { connected: boolean; appId?: string } {
    if (!this.feishuService) {
      return { connected: false }
    }
    return this.feishuService.getConnectionStatus()
  }
}
