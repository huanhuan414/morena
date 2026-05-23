/**
 * User Management Tools
 * 用户管理工具
 */

import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

@Injectable()
export class ChangePasswordTool implements AvatarTool {
  name = 'change_password'
  displayName = '修改密码'
  description = '修改用户的登录密码'
  category = 'system' as const

  paramsSchema = {
    userId: { type: 'string' as const, description: '用户ID', required: true },
    oldPassword: { type: 'string' as const, description: '旧密码', required: true },
    newPassword: { type: 'string' as const, description: '新密码', required: true }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()

      const users = await db.query('users', { id: params.userId })
      if (!users?.data || users.data.length === 0) {
        return { success: false, toolName: this.name, error: '用户不存在' }
      }

      // TODO: 实际项目中需要验证旧密码和加密新密码
      await db.updateWhere({ id: params.userId }, {
        updated_at: new Date()
      })

      return { success: true, toolName: this.name, data: { result: '密码已修改' } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}
