/**
 * Avatar Management Tools
 * 分身管理工具
 */

import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

/**
 * 查询分身好友列表工具
 */
@Injectable()
export class QueryAvatarFriendsTool implements AvatarTool {
  name = 'query_avatar_friends'
  displayName = '查询分身好友'
  description = '查询指定分身的好友列表'
  category = 'data' as const

  paramsSchema = {
    avatarId: {
      type: 'string' as const,
      description: '分身ID',
      required: true
    },
    status: {
      type: 'string' as const,
      description: '好友状态：active-已激活, pending-待确认',
      default: 'active'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { avatarId, status } = params

      // 查询分身好友关系
      // 双向查询：既是发起者也是接受者
      const { data: friendships, error } = await getSupabaseClient()
        .from('avatar_friends')
        .select(`
          id,
          avatar_id,
          friend_avatar_id,
          match_reason,
          compatibility_score,
          status,
          created_at,
          friend_avatar:avatars!avatar_friends_friend_avatar_id_fkey (
            id,
            name,
            avatar_url,
            personality,
            level
          ),
          avatar:avatars!avatar_friends_avatar_id_fkey (
            id,
            name,
            avatar_url,
            personality,
            level
          )
        `)
        .or(`avatar_id.eq.${avatarId},friend_avatar_id.eq.${avatarId}`)
        .eq('status', status || 'active')

      if (error) {
        return {
          success: false,
          toolName: this.name,
          error: error.message
        }
      }

      // 整理好友列表：只返回对方分身的信息
      const friends = (friendships || []).map((friendship: any) => {
        // 如果当前分身是发起者，则对方是 friend_avatar
        // 如果当前分身是接受者，则对方是 avatar
        const isInitiator = friendship.avatar_id === avatarId
        const friendData = isInitiator ? friendship.friend_avatar : friendship.avatar

        return {
          id: friendData?.id,
          name: friendData?.name,
          avatarUrl: friendData?.avatar_url,
          personality: friendData?.personality,
          level: friendData?.level,
          friendshipId: friendship.id,
          matchReason: friendship.match_reason,
          compatibilityScore: friendship.compatibility_score,
          createdAt: friendship.created_at
        }
      })

      return {
        success: true,
        toolName: this.name,
        data: {
          avatarId,
          friends,
          total: friends.length
        },
        executionTime: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}

/**
 * 添加分身好友工具
 */
@Injectable()
export class AddAvatarFriendTool implements AvatarTool {
  name = 'add_avatar_friend'
  displayName = '添加分身好友'
  description = '为分身添加新的好友'
  category = 'social' as const

  paramsSchema = {
    avatarId: {
      type: 'string' as const,
      description: '当前分身ID',
      required: true
    },
    friendAvatarId: {
      type: 'string' as const,
      description: '要添加的好友分身ID',
      required: true
    },
    matchReason: {
      type: 'string' as const,
      description: '匹配原因',
      default: '手动添加'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { avatarId, friendAvatarId, matchReason } = params

      // 检查是否已经是好友
      const { data: existing } = await getSupabaseClient()
        .from('avatar_friends')
        .select('id')
        .or(`avatar_id.eq.${avatarId},friend_avatar_id.eq.${avatarId}`)
        .eq('status', 'active')
        .maybeSingle()

      if (existing) {
        return {
          success: false,
          toolName: this.name,
          error: '已经是好友关系'
        }
      }

      // 创建好友关系
      const { error } = await getSupabaseClient()
        .from('avatar_friends')
        .insert({
          avatar_id: avatarId,
          friend_avatar_id: friendAvatarId,
          match_reason: matchReason || '手动添加',
          compatibility_score: Math.floor(Math.random() * 40) + 60, // 随机 60-100
          status: 'active',
          created_at: new Date().toISOString()
        })

      if (error) {
        return {
          success: false,
          toolName: this.name,
          error: error.message
        }
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          message: '好友添加成功',
          avatarId,
          friendAvatarId
        },
        executionTime: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}

/**
 * 移除分身好友工具
 */
@Injectable()
export class RemoveAvatarFriendTool implements AvatarTool {
  name = 'remove_avatar_friend'
  displayName = '移除分身好友'
  description = '移除分身的好友'
  category = 'social' as const

  paramsSchema = {
    avatarId: {
      type: 'string' as const,
      description: '当前分身ID',
      required: true
    },
    friendAvatarId: {
      type: 'string' as const,
      description: '要移除的好友分身ID',
      required: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { avatarId, friendAvatarId } = params

      // 删除好友关系（双向）
      await getSupabaseClient()
        .from('avatar_friends')
        .delete()
        .eq('avatar_id', avatarId)
        .eq('friend_avatar_id', friendAvatarId)

      await getSupabaseClient()
        .from('avatar_friends')
        .delete()
        .eq('avatar_id', friendAvatarId)
        .eq('friend_avatar_id', avatarId)

      return {
        success: true,
        toolName: this.name,
        data: {
          message: '好友已移除',
          avatarId,
          friendAvatarId
        },
        executionTime: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}

/**
 * 查询分身信息工具
 */
@Injectable()
export class QueryAvatarProfileTool implements AvatarTool {
  name = 'query_avatar_profile'
  displayName = '查询分身信息'
  description = '查询分身的详细信息'
  category = 'data' as const

  paramsSchema = {
    avatarId: {
      type: 'string' as const,
      description: '分身ID',
      required: true
    },
    fields: {
      type: 'array' as const,
      description: '要查询的字段，不传则查询全部',
      default: []
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { data, error } = await getSupabaseClient()
        .from('avatars')
        .select('*')
        .eq('id', params.avatarId)
        .single()

      if (error) {
        return {
          success: false,
          toolName: this.name,
          error: error.message
        }
      }

      // 如果指定了字段，只返回指定字段
      const result = params.fields && params.fields.length > 0
        ? params.fields.reduce((acc: any, field: string) => {
            acc[field] = data[field]
            return acc
          }, {})
        : data

      return {
        success: true,
        toolName: this.name,
        data: result,
        executionTime: Date.now() - startTime
      }
    } catch (error: any) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}
