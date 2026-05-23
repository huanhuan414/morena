/**
 * Avatar Management Tools
 * 分身管理工具
 */

import { Injectable } from '@nestjs/common'
import { getMySQLClient, deleteRow } from '../../../storage/database/mysql-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import * as crypto from 'crypto'

@Injectable()
export class QueryAvatarFriendsTool implements AvatarTool {
  name = 'query_avatar_friends'
  displayName = '查询分身好友'
  description = '查询指定分身的好友列表'
  category = 'data' as const

  paramsSchema = {
    avatarId: { type: 'string' as const, description: '分身ID', required: true },
    status: { type: 'string' as const, description: '好友状态', default: 'active' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const friendships = await db.query('avatar_friends', {
        avatar_id: params.avatarId,
        status: params.status || 'active'
      })

      const friends = ((friendships?.data || []) as any[]).map((f: any) => ({
        id: f.friend_avatar_id,
        friendshipId: f.id,
        matchReason: f.match_reason,
        compatibilityScore: f.compatibility_score
      }))

      return { success: true, toolName: this.name, data: { friends, total: friends.length } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}

@Injectable()
export class AddAvatarFriendTool implements AvatarTool {
  name = 'add_avatar_friend'
  displayName = '添加分身好友'
  description = '为分身添加新的好友'
  category = 'social' as const

  paramsSchema = {
    avatarId: { type: 'string' as const, description: '当前分身ID', required: true },
    friendAvatarId: { type: 'string' as const, description: '要添加的好友分身ID', required: true }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = crypto.randomUUID()

      // 检查是否已经是好友
      const existing = await db.query('avatar_friends', {
        avatar_id: params.avatarId,
        friend_avatar_id: params.friendAvatarId,
        status: 'active'
      })

      if (existing?.data && existing.data.length > 0) {
        return { success: false, toolName: this.name, error: '已经是好友关系' }
      }

      await db.insert('avatar_friends', {
        id,
        avatar_id: params.avatarId,
        friend_avatar_id: params.friendAvatarId,
        match_reason: '手动添加',
        compatibility_score: Math.floor(Math.random() * 40) + 60,
        status: 'active',
        created_at: new Date()
      })

      return { success: true, toolName: this.name, data: { message: '好友添加成功' } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}

@Injectable()
export class RemoveAvatarFriendTool implements AvatarTool {
  name = 'remove_avatar_friend'
  displayName = '移除分身好友'
  description = '移除分身的好友'
  category = 'social' as const

  paramsSchema = {
    avatarId: { type: 'string' as const, description: '当前分身ID', required: true },
    friendAvatarId: { type: 'string' as const, description: '要移除的好友分身ID', required: true }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      await deleteRow('avatar_friends', {
        avatar_id: params.avatarId,
        friend_avatar_id: params.friendAvatarId
      })
      return { success: true, toolName: this.name, data: { message: '好友已移除' } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}
