import { Inject, Controller, Get, Post, Delete, Body, Param, Headers } from '@nestjs/common'
import { ChatService } from './chat.service'

@Controller('chat')
export class ChatController {
  constructor(@Inject(ChatService) private readonly chatService: ChatService) {}

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
  async getMessages(@Param('id') conversationId: string) {
    const messages = await this.chatService.getMessages(conversationId)
    return {
      code: 200,
      data: messages,
      message: '获取成功'
    }
  }

  @Post('send')
  async sendMessage(
    @Headers('x-user-id') userId: string,
    @Body() body: { conversation_id: string; content: string; role?: string }
  ) {
    const message = await this.chatService.addMessage(body.conversation_id, {
      role: body.role || 'user',
      content: body.content
    })
    return {
      code: 200,
      data: message,
      message: '发送成功'
    }
  }

  @Delete('conversation/:id')
  async deleteConversation(
    @Param('id') conversationId: string,
    @Headers('x-user-id') userId: string
  ) {
    await this.chatService.deleteConversation(userId, conversationId)
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }
}
