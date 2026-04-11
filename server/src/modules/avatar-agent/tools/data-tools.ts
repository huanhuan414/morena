/**
 * Data Query Tools
 * 数据查询工具
 */

import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

/**
 * 查询用户信息工具
 */
@Injectable()
export class QueryUserProfileTool implements AvatarTool {
  name = 'query_user_profile'
  displayName = '查询用户信息'
  description = '查询用户的基本信息、偏好设置等'
  category = 'data' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
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
        .from('user_profiles')
        .select('*')
        .eq('id', params.userId)
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
        ? params.fields.reduce((acc, field) => {
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
    } catch (error) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}

/**
 * 查询订单工具
 */
@Injectable()
export class QueryOrdersTool implements AvatarTool {
  name = 'query_orders'
  displayName = '查询订单'
  description = '查询用户的订单列表'
  category = 'data' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    status: {
      type: 'string' as const,
      description: '订单状态：pending-待处理, active-进行中, completed-已完成, cancelled-已取消',
      enum: ['pending', 'active', 'completed', 'cancelled']
    },
    limit: {
      type: 'number' as const,
      description: '返回数量限制',
      default: 20
    },
    offset: {
      type: 'number' as const,
      description: '偏移量',
      default: 0
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      let query = getSupabaseClient()
        .from('orders')
        .select('*')
        .eq('user_id', params.userId)

      if (params.status) {
        query = query.eq('status', params.status)
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(params.offset || 0, (params.offset || 0) + (params.limit || 20) - 1)

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
          orders: data || [],
          total: data?.length || 0,
          pagination: {
            limit: params.limit,
            offset: params.offset
          }
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}

/**
 * 查询好友列表工具
 */
@Injectable()
export class QueryFriendsTool implements AvatarTool {
  name = 'query_friends'
  displayName = '查询好友'
  description = '查询用户的好友列表'
  category = 'data' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    status: {
      type: 'string' as const,
      description: '好友状态：accepted-已接受, pending-待确认',
      default: 'accepted'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      // 查询好友关系
      const { data: friendships, error } = await getSupabaseClient()
        .from('friendships')
        .select(`
          *,
          user:users!friendships_user_id_fkey(id, username, avatar_url),
          friend:users!friendships_friend_id_fkey(id, username, avatar_url)
        `)
        .or(`user_id.eq.${params.userId},friend_id.eq.${params.userId}`)
        .eq('status', params.status || 'accepted')

      if (error) {
        return {
          success: false,
          toolName: this.name,
          error: error.message
        }
      }

      // 整理好友列表
      const friends = (friendships || []).map(friendship => {
        const isRequester = friendship.user_id === params.userId
        const friendData = isRequester ? friendship.friend : friendship.user
        return {
          id: friendData.id,
          username: friendData.username,
          avatarUrl: friendData.avatar_url,
          friendshipId: friendship.id,
          createdAt: friendship.created_at
        }
      })

      return {
        success: true,
        toolName: this.name,
        data: {
          friends,
          total: friends.length
        },
        executionTime: Date.now() - startTime
      }
    } catch (error) {
      return {
        success: false,
        toolName: this.name,
        error: error.message
      }
    }
  }
}
