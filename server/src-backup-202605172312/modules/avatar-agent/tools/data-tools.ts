/**
 * Data Query Tools
 * 数据查询工具
 */

import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

@Injectable()
export class QueryUserProfileTool implements AvatarTool {
  name = 'query_user_profile'
  displayName = '查询用户信息'
  description = '查询用户的基本信息、偏好设置等'
  category = 'data' as const

  paramsSchema = {
    userId: { type: 'string' as const, description: '用户ID', required: true },
    fields: { type: 'array' as const, description: '要查询的字段', default: [] }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const profiles = await db.query('users', { id: params.userId })

      if (!profiles?.data || profiles.data.length === 0) {
        return { success: false, toolName: this.name, error: '用户不存在' }
      }

      const data = profiles.data[0]
      const result = params.fields && params.fields.length > 0
        ? params.fields.reduce((acc: any, field: string) => { acc[field] = data[field]; return acc }, {})
        : data

      return { success: true, toolName: this.name, data: result }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}

@Injectable()
export class QueryOrdersTool implements AvatarTool {
  name = 'query_orders'
  displayName = '查询订单'
  description = '查询用户的订单列表'
  category = 'data' as const

  paramsSchema = {
    userId: { type: 'string' as const, description: '用户ID', required: true },
    status: { type: 'string' as const, description: '订单状态' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const filter: any = { user_id: params.userId }
      if (params.status) filter.status = params.status

      const orders = await db.query('orders', filter)
      return { success: true, toolName: this.name, data: { orders: orders?.data || [] } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}
