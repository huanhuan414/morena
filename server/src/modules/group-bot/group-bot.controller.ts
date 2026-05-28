import { Controller, Get, Post, Delete, Body, Param, Query, Req, Logger } from '@nestjs/common'
import { Request } from 'express'
import { GroupBotService } from './group-bot.service'
import { CreateGroupDto, UpdateGroupStatusDto, CorrectMessageDto, WebhookPayloadDto, TriggerReplyDto } from './dto/group-bot.dto'

@Controller('group-bot')
export class GroupBotController {
  private readonly logger = new Logger(GroupBotController.name)

  constructor(private readonly groupBotService: GroupBotService) {}

  @Post('groups')
  async createGroup(@Req() req: Request, @Body() dto: CreateGroupDto) {
    const userId = (req as any).user?.id || 'default_user'
    console.log(`[GroupBot] POST /api/group-bot/groups - userId: ${userId}, dto:`, JSON.stringify(dto))
    const group = await this.groupBotService.createGroup(userId, dto)
    return { code: 200, msg: 'success', data: group }
  }

  @Get('groups')
  async getGroups(@Req() req: Request) {
    const userId = (req as any).user?.id || 'default_user'
    console.log(`[GroupBot] GET /api/group-bot/groups - userId: ${userId}`)
    const groups = await this.groupBotService.getGroups(userId)
    return { code: 200, msg: 'success', data: groups }
  }

  @Get('groups/:id')
  async getGroup(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.id || 'default_user'
    const group = await this.groupBotService.getGroupById(id, userId)
    if (!group) {
      return { code: 404, msg: '群不存在', data: null }
    }
    return { code: 200, msg: 'success', data: group }
  }

  @Post('groups/:id/status')
  async updateGroupStatus(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateGroupStatusDto,
  ) {
    const userId = (req as any).user?.id || 'default_user'
    console.log(`[GroupBot] POST /api/group-bot/groups/${id}/status - dto:`, JSON.stringify(dto))
    const group = await this.groupBotService.updateGroupStatus(id, userId, dto)
    if (!group) {
      return { code: 404, msg: '群不存在', data: null }
    }
    return { code: 200, msg: 'success', data: group }
  }

  @Delete('groups/:id')
  async deleteGroup(@Req() req: Request, @Param('id') id: string) {
    const userId = (req as any).user?.id || 'default_user'
    console.log(`[GroupBot] DELETE /api/group-bot/groups/${id}`)
    const deleted = await this.groupBotService.deleteGroup(id, userId)
    if (!deleted) {
      return { code: 404, msg: '群不存在', data: null }
    }
    return { code: 200, msg: '删除成功', data: null }
  }

  @Get('groups/:id/messages')
  async getMessages(
    @Req() req: Request,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    const userId = (req as any).user?.id || 'default_user'
    const messages = await this.groupBotService.getMessages(id, userId, limit ? parseInt(limit) : 50)
    return { code: 200, msg: 'success', data: messages }
  }

  @Post('groups/:id/reply')
  async triggerReply(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: TriggerReplyDto,
  ) {
    const userId = (req as any).user?.id || 'default_user'
    console.log(`[GroupBot] POST /api/group-bot/groups/${id}/reply - messageId: ${dto.messageId}`)
    const reply = await this.groupBotService.triggerAvatarReply(id, userId, dto)
    if (!reply) {
      return { code: 404, msg: '消息不存在或群不存在', data: null }
    }
    return { code: 200, msg: 'success', data: reply }
  }

  @Post('messages/:id/correct')
  async correctMessage(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CorrectMessageDto,
  ) {
    const userId = (req as any).user?.id || 'default_user'
    console.log(`[GroupBot] POST /api/group-bot/messages/${id}/correct - correction: ${dto.correction}`)
    const msg = await this.groupBotService.correctMessage(id, userId, dto)
    if (!msg) {
      return { code: 404, msg: '消息不存在', data: null }
    }
    return { code: 200, msg: 'success', data: msg }
  }

  @Post('webhook/:platform')
  async handleWebhook(@Param('platform') platform: string, @Body() payload: any) {
    this.logger.log(`[GroupBot] Webhook from ${platform}: ${JSON.stringify(payload).substring(0, 200)}`)
    const dto: WebhookPayloadDto = {
      platform: platform as 'wecom' | 'feishu',
      groupId: payload.groupId || payload.chatid || '',
      senderName: payload.senderName || payload.sender?.name || '',
      content: payload.content || payload.text || '',
      msgType: payload.msgType,
      rawPayload: payload,
    }
    try {
      const msg = await this.groupBotService.handleWebhook(dto)
      return { code: 200, msg: 'success', data: msg }
    } catch (error) {
      this.logger.error(`Webhook error: ${error.message}`)
      return { code: 500, msg: error.message, data: null }
    }
  }
}
