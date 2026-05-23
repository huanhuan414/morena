/**
 * Agent WebSocket Gateway
 * 实现任务执行进度的实时推送
 */

import { 
  WebSocketGateway, 
  WebSocketServer, 
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect 
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { Injectable } from '@nestjs/common'

interface TaskProgress {
  taskId: string
  userId: string
  type: string
  message: string
  data?: any
  timestamp: number
}

@Injectable()
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true
  },
  namespace: '/agent'
})
export class AgentGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server

  // 存储用户ID和Socket的映射
  private userSockets: Map<string, Set<string>> = new Map()

  handleConnection(client: Socket) {
    const userId = client.handshake.query.userId as string
    if (userId) {
      client.join(`user:${userId}`)
      
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set())
      }
      this.userSockets.get(userId)!.add(client.id)
      
      console.log(`[WebSocket] 用户 ${userId} 已连接, socket: ${client.id}`)
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.handshake.query.userId as string
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id)
      if (this.userSockets.get(userId)!.size === 0) {
        this.userSockets.delete(userId)
      }
    }
    console.log(`[WebSocket] Socket ${client.id} 已断开`)
  }

  /**
   * 向指定用户推送任务进度
   */
  emitProgress(userId: string, progress: TaskProgress) {
    this.server.to(`user:${userId}`).emit('task-progress', progress)
  }

  /**
   * 订阅任务进度
   */
  @SubscribeMessage('subscribe-task')
  handleSubscribeTask(client: Socket, payload: { taskId: string }) {
    client.join(`task:${payload.taskId}`)
    return { success: true, message: `已订阅任务 ${payload.taskId}` }
  }

  /**
   * 取消订阅任务
   */
  @SubscribeMessage('unsubscribe-task')
  handleUnsubscribeTask(client: Socket, payload: { taskId: string }) {
    client.leave(`task:${payload.taskId}`)
    return { success: true, message: `已取消订阅任务 ${payload.taskId}` }
  }

  /**
   * 获取在线用户数
   */
  getOnlineUserCount(): number {
    return this.userSockets.size
  }
}
