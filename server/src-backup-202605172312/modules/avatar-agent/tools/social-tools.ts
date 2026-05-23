/**
 * Social Interaction Tools
 * 社交互动工具
 */

import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import * as crypto from 'crypto'

@Injectable()
export class AvatarSendMessageTool implements AvatarTool {
  name = 'avatar_send_message'
  displayName = '发送消息'
  description = '向指定用户发送消息'
  category = 'social' as const

  paramsSchema = {
    toUserId: { type: 'string' as const, description: '接收者用户ID', required: true },
    content: { type: 'string' as const, description: '消息内容', required: true },
    messageType: { type: 'string' as const, description: '消息类型：text, image, audio, video', default: 'text' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = crypto.randomUUID()

      await db.insert('notifications', {
        id,
        user_id: params.toUserId,
        avatar_id: context.avatarId,
        type: params.messageType || 'text',
        title: 'AI分身消息',
        content: params.content,
        is_read: 0,
        created_at: new Date()
      })

      return {
        success: true,
        toolName: this.name,
        data: { messageId: id, result: '消息已发送' }
      }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}

@Injectable()
export class AvatarCreateMomentTool implements AvatarTool {
  name = 'avatar_create_moment'
  displayName = '发布朋友圈'
  description = '创建朋友圈动态'
  category = 'social' as const

  paramsSchema = {
    content: { type: 'string' as const, description: '动态内容', required: true },
    images: { type: 'array' as const, description: '图片列表' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = crypto.randomUUID()

      await db.insert('posts', {
        id,
        user_id: context.userId,
        avatar_id: context.avatarId,
        content: params.content,
        images: Array.isArray(params.images) ? params.images.join(',') : '',
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        created_at: new Date()
      })

      return { success: true, toolName: this.name, data: { postId: id, result: '动态已发布' } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}
