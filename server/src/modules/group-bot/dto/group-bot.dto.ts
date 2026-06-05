export class CreateGroupDto {
  groupName: string
  platform: 'wecom' | 'feishu'
  webhookUrl: string
  avatarId?: string
}

export class UpdateGroupStatusDto {
  status: 'active' | 'paused'
}

export class CorrectMessageDto {
  messageId: string
  correction: string
}

export class SendMessageDto {
  content: string
  asAvatar: boolean
}

export class TriggerReplyDto {
  messageId: string
}

export class WebhookPayloadDto {
  platform: 'wecom' | 'feishu'
  groupId: string
  senderName?: string
  content: string
  msgType?: string
  rawPayload?: any
}
