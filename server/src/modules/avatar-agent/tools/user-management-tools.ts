/**
 * User Management Tools
 * 用户管理工具
 */

import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'

/**
 * 修改用户密码工具
 */
@Injectable()
export class ChangePasswordTool implements AvatarTool {
  name = 'change_password'
  displayName = '修改密码'
  description = '修改用户的登录密码'
  category = 'system' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    oldPassword: {
      type: 'string' as const,
      description: '旧密码',
      required: true
    },
    newPassword: {
      type: 'string' as const,
      description: '新密码',
      required: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      // TODO: 实际的密码修改逻辑
      // 1. 验证旧密码是否正确
      // 2. 更新新密码（需要加密）
      // 3. 记录操作日志

      // 模拟实现
      const { userId, oldPassword, newPassword } = params

      // 验证旧密码
      const { data: user, error: fetchError } = await getSupabaseClient()
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError || !user) {
        return {
          success: false,
          toolName: this.name,
          error: '用户不存在'
        }
      }

      // TODO: 实际项目中需要验证旧密码
      // if (!verifyPassword(oldPassword, user.password_hash)) {
      //   return { success: false, error: '旧密码错误' }
      // }

      // TODO: 实际项目中需要加密新密码
      // const hashedPassword = await hashPassword(newPassword)

      // 更新密码
      const { error: updateError } = await getSupabaseClient()
        .from('users')
        .update({
          password_hash: 'hashed_password_placeholder', // 实际应该是加密后的密码
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        return {
          success: false,
          toolName: this.name,
          error: updateError.message
        }
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          message: '密码修改成功',
          userId
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
 * 更新用户资料工具
 */
@Injectable()
export class UpdateProfileTool implements AvatarTool {
  name = 'update_profile'
  displayName = '更新资料'
  description = '更新用户的个人资料信息'
  category = 'system' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    username: {
      type: 'string' as const,
      description: '用户名'
    },
    nickname: {
      type: 'string' as const,
      description: '昵称'
    },
    bio: {
      type: 'string' as const,
      description: '个人简介'
    },
    avatarUrl: {
      type: 'string' as const,
      description: '头像URL'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { userId, ...updates } = params

      // 过滤掉 undefined 的字段
      const validUpdates = Object.keys(updates).reduce((acc, key) => {
        if (updates[key] !== undefined) {
          acc[key] = updates[key]
        }
        return acc
      }, {})

      if (Object.keys(validUpdates).length === 0) {
        return {
          success: false,
          toolName: this.name,
          error: '没有提供需要更新的字段'
        }
      }

      const { error } = await getSupabaseClient()
        .from('user_profiles')
        .update({
          ...validUpdates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

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
          message: '资料更新成功',
          updatedFields: Object.keys(validUpdates)
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
 * 上传头像工具
 */
@Injectable()
export class UploadAvatarTool implements AvatarTool {
  name = 'upload_avatar'
  displayName = '上传头像'
  description = '为用户上传新头像'
  category = 'system' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    fileUrl: {
      type: 'string' as const,
      description: '头像文件URL（已上传到对象存储）',
      required: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { userId, fileUrl } = params

      // 更新用户资料中的头像
      const { error } = await getSupabaseClient()
        .from('user_profiles')
        .update({
          avatar_url: fileUrl,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)

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
          message: '头像上传成功',
          avatarUrl: fileUrl
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
 * 绑定手机号工具
 */
@Injectable()
export class BindPhoneTool implements AvatarTool {
  name = 'bind_phone'
  displayName = '绑定手机'
  description = '绑定用户手机号'
  category = 'system' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    phoneNumber: {
      type: 'string' as const,
      description: '手机号',
      required: true
    },
    verificationCode: {
      type: 'string' as const,
      description: '验证码',
      required: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { userId, phoneNumber, verificationCode } = params

      // TODO: 验证验证码是否正确
      // const isValid = await verifySmsCode(phoneNumber, verificationCode)
      // if (!isValid) {
      //   return { success: false, error: '验证码错误' }
      // }

      // 更新用户手机号
      const { error } = await getSupabaseClient()
        .from('users')
        .update({
          phone: phoneNumber,
          phone_verified: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

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
          message: '手机号绑定成功',
          phoneNumber
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
 * 删除账号工具
 */
@Injectable()
export class DeleteAccountTool implements AvatarTool {
  name = 'delete_account'
  displayName = '删除账号'
  description = '删除用户账号（危险操作）'
  category = 'system' as const

  paramsSchema = {
    userId: {
      type: 'string' as const,
      description: '用户ID',
      required: true
    },
    confirm: {
      type: 'boolean' as const,
      description: '确认删除（需要显式设置为 true）',
      required: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()

      const { userId, confirm } = params

      if (!confirm) {
        return {
          success: false,
          toolName: this.name,
          error: '需要明确确认删除操作'
        }
      }

      // TODO: 实际项目中应该：
      // 1. 软删除用户账号（标记为已删除）
      // 2. 删除用户的关联数据（或匿名化）
      // 3. 发送删除确认通知
      // 4. 保留一段时间以供恢复

      // 软删除
      const { error } = await getSupabaseClient()
        .from('users')
        .update({
          status: 'deleted',
          deleted_at: new Date().toISOString()
        })
        .eq('id', userId)

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
          message: '账号已删除',
          userId
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
