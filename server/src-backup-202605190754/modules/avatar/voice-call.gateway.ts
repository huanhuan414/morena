// @ts-nocheck
/**
 * Voice Call WebSocket Gateway
 * 实现实时语音通话功能
 */

import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable, Logger } from '@nestjs/common'
import { VoiceCallService } from './voice-call.service'

interface CallSession {
  callId: string
  avatarId: string
  friendAvatarId: string
  userId: string
  status: 'connecting' | 'active' | 'ended'
  messages: Array<{ role: 'user' | 'assistant'; content: string; audioUrl?: string }>
  createdAt: Date
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: '/voice-call'
})
export class VoiceCallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  private readonly logger = new Logger(VoiceCallGateway.name)
  
  // 存储通话会话
  private callSessions: Map<string, CallSession> = new Map()
  
  // 存储 socket 到 callId 的映射
  private socketCallMap: Map<string, string> = new Map()

  constructor(private readonly voiceCallService: VoiceCallService) {}

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string
    this.logger.log(`[语音通话] 用户 ${userId} 连接, socket: ${client.id}`)
  }

  handleDisconnect(client: Socket) {
    const callId = this.socketCallMap.get(client.id)
    if (callId) {
      this.doEndCall(client, callId)
    }
    this.logger.log(`[语音通话] Socket ${client.id} 断开`)
  }

  /**
   * 执行结束通话逻辑
   */
  private doEndCall(client: Socket, callId: string) {
    const session = this.callSessions.get(callId)

    if (session) {
      session.status = 'ended'
      this.logger.log(`[语音通话] 通话结束: ${callId}, 消息数: ${session.messages.length}`)
      
      // 发送通话结束事件
      client.emit('call-ended', {
        callId,
        duration: Date.now() - session.createdAt.getTime(),
        messageCount: session.messages.length
      })

      // 清理
      this.callSessions.delete(callId)
      this.socketCallMap.delete(client.id)
      client.leave(callId)
    }
  }

  /**
   * 发起语音通话
   */
  @SubscribeMessage('start-call')
  async handleStartCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { avatarId: string; friendAvatarId: string; userId: string }
  ) {
    const { avatarId, friendAvatarId, userId } = payload
    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    this.logger.log(`[语音通话] 发起通话: ${callId}, 用户: ${userId}, 分身: ${avatarId}, 好友: ${friendAvatarId}`)

    // 创建通话会话
    const session: CallSession = {
      callId,
      avatarId,
      friendAvatarId,
      userId,
      status: 'connecting',
      messages: [],
      createdAt: new Date()
    }
    this.callSessions.set(callId, session)
    this.socketCallMap.set(client.id, callId)
    client.join(callId)

    try {
      // 生成初始问候语
      const greeting = await this.voiceCallService.generateGreeting(avatarId, friendAvatarId, userId)
      
      // 更新会话状态
      session.status = 'active'
      session.messages.push({ role: 'assistant', content: greeting.text, audioUrl: greeting.audioUrl })

      // 发送通话开始事件
      client.emit('call-started', {
        callId,
        greeting: greeting.text,
        audioUrl: greeting.audioUrl
      })

      return { success: true, callId, greeting }
    } catch (error) {
      this.logger.error(`[语音通话] 发起通话失败: ${error.message}`)
      this.callSessions.delete(callId)
      this.socketCallMap.delete(client.id)
      return { success: false, error: error.message }
    }
  }

  /**
   * 发送语音消息（用户说话）
   */
  @SubscribeMessage('send-audio')
  async handleSendAudio(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; audioUrl: string }
  ) {
    const { callId, audioUrl } = payload
    const session = this.callSessions.get(callId)

    if (!session || session.status !== 'active') {
      return { success: false, error: '通话不存在或已结束' }
    }

    this.logger.log(`[语音通话] 收到语音: ${callId}`)

    try {
      // 通知前端正在处理
      client.emit('processing', { callId })

      // 添加用户消息
      session.messages.push({ role: 'user', content: '用户语音消息' })

      // 生成回复
      const reply = await this.voiceCallService.generateReply(
        session.avatarId,
        session.friendAvatarId,
        session.messages,
        session.userId
      )

      // 添加助手消息
      session.messages.push({ role: 'assistant', content: reply.text, audioUrl: reply.audioUrl })

      // 发送回复
      client.emit('receive-reply', {
        callId,
        replyText: reply.text,
        audioUrl: reply.audioUrl
      })

      return { success: true, replyText: reply.text, audioUrl: reply.audioUrl }
    } catch (error) {
      this.logger.error(`[语音通话] 处理语音失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * 发送文本消息（用户直接输入文字）
   */
  @SubscribeMessage('send-text')
  async handleSendText(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string; text: string }
  ) {
    const { callId, text } = payload
    const session = this.callSessions.get(callId)

    if (!session || session.status !== 'active') {
      return { success: false, error: '通话不存在或已结束' }
    }

    this.logger.log(`[语音通话] 收到文本: ${text}`)

    try {
      // 通知前端正在处理
      client.emit('processing', { callId })

      // 添加用户消息
      session.messages.push({ role: 'user', content: text })

      // 生成回复
      const reply = await this.voiceCallService.generateReply(
        session.avatarId,
        session.friendAvatarId,
        session.messages,
        session.userId
      )

      // 添加助手消息
      session.messages.push({ role: 'assistant', content: reply.text, audioUrl: reply.audioUrl })

      // 发送回复
      client.emit('receive-reply', {
        callId,
        userText: text,
        replyText: reply.text,
        audioUrl: reply.audioUrl
      })

      return { success: true, replyText: reply.text, audioUrl: reply.audioUrl }
    } catch (error) {
      this.logger.error(`[语音通话] 处理文本失败: ${error.message}`)
      return { success: false, error: error.message }
    }
  }

  /**
   * 结束通话
   */
  @SubscribeMessage('end-call')
  handleEndCall(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string }
  ) {
    this.doEndCall(client, payload.callId)
    return { success: true }
  }

  /**
   * 获取通话状态
   */
  @SubscribeMessage('get-call-status')
  handleGetCallStatus(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { callId: string }
  ) {
    const { callId } = payload
    const session = this.callSessions.get(callId)

    if (!session) {
      return { success: false, error: '通话不存在' }
    }

    return {
      success: true,
      status: session.status,
      messageCount: session.messages.length,
      duration: Date.now() - session.createdAt.getTime()
    }
  }
}
