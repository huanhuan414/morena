import { Controller, Get, Post, Delete, Body, Param, Headers, Req, Sse, MessageEvent, Query } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'
import { ChatService } from './chat.service'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversation')
  async createConversation(
    @Headers('x-user-id') userId: string,
    @Body('avatar_id') avatarId: string,
    @Body('title') title?: string
  ) {
    const conversation = await this.chatService.createConversation(userId, avatarId, title)
    return {
      code: 200,
      data: conversation,
      message: '创建成功'
    }
  }

  @Get('conversations')
  async getConversations(@Headers('x-user-id') userId: string) {
    const conversations = await this.chatService.getConversations(userId)
    return {
      code: 200,
      data: conversations,
      message: '获取成功'
    }
  }

  @Get('conversation/:id/messages')
  async getMessages(
    @Param('id') conversationId: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 20
    const messages = await this.chatService.getConversationMessages(conversationId, limitNum, before)
    return {
      code: 200,
      data: messages,
      message: '获取成功'
    }
  }

  @Post('send')
  async sendMessage(
    @Headers('x-user-id') userId: string,
    @Body() body: { conversation_id: string; avatar_id: string; content: string },
    @Req() req: any
  ) {
    const headers = req.headers
    const message = await this.chatService.sendMessage(
      body.conversation_id,
      userId,
      body.avatar_id,
      body.content,
      headers
    )
    return {
      code: 200,
      data: message,
      message: '发送成功'
    }
  }

  /**
   * 流式对话接口
   * 使用 Server-Sent Events (SSE) 实现流式输出
   */
  @Sse('stream')
  async streamMessage(
    @Headers('x-user-id') userId: string,
    @Body() body: { conversation_id: string; avatar_id: string; content: string },
    @Req() req: any
  ): Promise<Observable<MessageEvent>> {
    const headers = req.headers
    
    return new Observable(subscriber => {
      (async () => {
        try {
          const generator = this.chatService.sendMessageStream(
            body.conversation_id,
            userId,
            body.avatar_id,
            body.content,
            headers
          )
          
          for await (const chunk of generator) {
            subscriber.next({ data: chunk } as MessageEvent)
          }
          
          subscriber.complete()
        } catch (error) {
          subscriber.error(error)
        }
      })()
    })
  }

  @Delete('conversation/:id')
  async deleteConversation(
    @Param('id') conversationId: string,
    @Headers('x-user-id') userId: string
  ) {
    await this.chatService.deleteConversation(conversationId, userId)
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }

  /**
   * 直接调用LLM生成内容
   * 不需要创建对话，直接返回生成的文本
   */
  @Post('generate')
  async generateContent(@Body('prompt') prompt: string) {
    const content = await this.chatService.generateContent(prompt)
    return {
      code: 200,
      data: {
        content
      },
      message: '生成成功'
    }
  }
}
