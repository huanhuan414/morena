import { Injectable, Logger } from '@nestjs/common'
import { CreateGroupDto, UpdateGroupStatusDto, CorrectMessageDto, WebhookPayloadDto, TriggerReplyDto } from './dto/group-bot.dto'
import { LLMClient, Config } from 'coze-coding-dev-sdk'

interface GroupBot {
  id: string
  userId: string
  avatarId: string
  groupName: string
  platform: 'wecom' | 'feishu'
  webhookUrl: string
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
}
