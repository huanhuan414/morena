import { Controller, Get, Post, Delete, Body, Param, Query, Req, Res, Logger, RawBodyRequest } from '@nestjs/common'
import { Request, Response } from 'express'
import { GroupBotService } from './group-bot.service'
import { CreateGroupDto, UpdateGroupStatusDto, CorrectMessageDto, WebhookPayloadDto, TriggerReplyDto } from './dto/group-bot.dto'
import { verifyCallback, parseWecomXml, sha1Sign, decrypt, buildWecomResponse, encrypt } from './wecom/wecom-crypto'
import { WecomApiService } from './wecom/wecom-api.service'
import { ConfigService } from '@nestjs/config'

@Controller('group-bot')
export class GroupBotController {
  private readonly logger = new Logger(GroupBotController.name)

  constructor(
    private readonly groupBotService: GroupBotService,
    private readonly wecomApiService: WecomApiService,
    private readonly configService: ConfigService,
  ) {}

  // ========== 群管理 API ==========

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

  // ========== 企业微信回调 ==========

  /**
   * GET 验证回调URL有效性
   * 企业微信配置回调时会发 GET 请求验证
   */
  @Get('webhook/wecom')
  async verifyWecomCallback(
    @Query('msg_signature') msgSignature: string,
    @Query('timestamp') timestamp: string,
    @Query('nonce') nonce: string,
    @Query('echostr') echostr: string,
    @Res() res: Response,
  ) {
    const token = this.configService.get<string>('WECOM_TOKEN', 'morena2024wecom')
    const encodingAESKey = this.configService.get<string>('WECOM_ENCODING_AES_KEY', '')
    const corpId = this.configService.get<string>('WECOM_CORP_ID', '')

    console.log(`[GroupBot] GET /api/group-bot/webhook/wecom - 验证回调URL`)
    console.log(`  msg_signature: ${msgSignature}, timestamp: ${timestamp}, nonce: ${nonce}, echostr: ${echostr?.substring(0, 20)}...`)

    try {
      const echoStr = verifyCallback(token, encodingAESKey, corpId, msgSignature, timestamp, nonce, echostr)
      console.log(`[GroupBot] 回调URL验证成功, echostr: ${echoStr}`)
      // 企业微信要求直接返回明文 echostr，不能包裹 JSON
      res.send(echoStr)
    } catch (error) {
      this.logger.error(`回调URL验证失败: ${error.message}`)
      res.status(403).send('验证失败')
    }
  }

  /**
   * POST 接收企业微信消息回调
   * 员工在群里@莫瑞娜 时触发
   */
  @Post('webhook/wecom')
  async handleWecomMessage(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const token = this.configService.get<string>('WECOM_TOKEN', 'morena2024wecom')
    const encodingAESKey = this.configService.get<string>('WECOM_ENCODING_AES_KEY', '')
    const corpId = this.configService.get<string>('WECOM_CORP_ID', '')

    const msgSignature = req.query.msg_signature as string
    const timestamp = req.query.timestamp as string
    const nonce = req.query.nonce as string

    console.log(`[GroupBot] POST /api/group-bot/webhook/wecom - 收到消息`)

    try {
      // 1. 解析 XML
      const xmlData = await parseWecomXml(req.body)
      const encrypt = xmlData.Encrypt

      // 2. 验证签名
      const signature = sha1Sign(token, timestamp, nonce, encrypt)
      if (signature !== msgSignature) {
        this.logger.error(`签名验证失败`)
        res.send('success')
        return
      }

      // 3. 解密消息
      const { message, corpId: decryptedCorpId } = decrypt(encrypt, encodingAESKey)
      if (decryptedCorpId !== corpId) {
        this.logger.error(`CorpID不匹配: ${decryptedCorpId} vs ${corpId}`)
        res.send('success')
        return
      }

      // 4. 解析消息内容
      const msgXml = await parseWecomXml(message)
      console.log(`[GroupBot] 企业微信消息:`, JSON.stringify(msgXml))

      const msgType = msgXml.MsgType
      const fromUserName = msgXml.FromUserName  // 发送者 UserID
      const content = msgXml.Content             // 消息内容
      const chatId = msgXml.ChatId               // 群聊 ID（如果是群消息）

      // 5. 只处理文本消息
      if (msgType === 'text' && content) {
        console.log(`[GroupBot] 收到文本消息: from=${fromUserName}, chatId=${chatId}, content=${content}`)

        // 6. 生成分身回复
        const replyContent = await this.groupBotService.generateWecomReply(fromUserName, content, chatId)

        // 7. 发送回复
        if (chatId) {
          // 群聊消息，发回群里
          await this.wecomApiService.sendAppchatMessage(chatId, replyContent)
        } else {
          // 私聊消息，发给用户
          await this.wecomApiService.sendTextMessage(fromUserName, replyContent)
        }
      }

      // 企业微信要求5秒内返回 "success"，否则会重试
      res.send('success')
    } catch (error) {
      this.logger.error(`处理企业微信消息失败: ${error.message}`)
      res.send('success')
    }
  }

  // ========== 通用 Webhook（飞书等） ==========

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
