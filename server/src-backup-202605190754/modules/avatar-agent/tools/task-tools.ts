/**
 * Task Management Tools
 * 任务管理工具
 */

import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import * as crypto from 'crypto'

@Injectable()
export class CreateTaskTool implements AvatarTool {
  name = 'create_task'
  displayName = '创建任务'
  description = '创建一个新任务'
  category = 'task' as const

  paramsSchema = {
    title: { type: 'string' as const, description: '任务标题', required: true },
    description: { type: 'string' as const, description: '任务描述', default: '' },
    priority: { type: 'string' as const, description: '优先级：low, medium, high, urgent', default: 'medium' },
    dueDate: { type: 'string' as const, description: '截止日期' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = crypto.randomUUID()

      await db.insert('tasks', {
        id,
        user_id: context.userId,
        avatar_id: params.assignedToAvatarId || context.avatarId,
        title: params.title,
        description: params.description || '',
        priority: params.priority || 'medium',
        status: 'pending',
        progress: 0,
        due_date: params.dueDate,
        created_at: new Date(),
        updated_at: new Date()
      })

      return {
        success: true,
        toolName: this.name,
        data: { taskId: id, result: '任务已创建' }
      }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}

@Injectable()
export class QueryTasksTool implements AvatarTool {
  name = 'query_tasks'
  displayName = '查询任务'
  description = '查询用户的任务列表'
  category = 'task' as const

  paramsSchema = {
    status: { type: 'string' as const, description: '任务状态' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const filter: any = { user_id: context.userId }
      if (params.status) filter.status = params.status

      const tasks = await db.query('tasks', filter)
      return { success: true, toolName: this.name, data: { tasks: tasks || [] } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}

@Injectable()
export class UpdateTaskTool implements AvatarTool {
  name = 'update_task'
  displayName = '更新任务'
  description = '更新任务状态或进度'
  category = 'task' as const

  paramsSchema = {
    taskId: { type: 'string' as const, description: '任务ID', required: true },
    status: { type: 'string' as const, description: '任务状态' },
    progress: { type: 'number' as const, description: '进度' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const updateData: any = { updated_at: new Date() }
      if (params.status) updateData.status = params.status
      if (params.progress !== undefined) updateData.progress = params.progress

      await db.updateWhere({ id: params.taskId, user_id: context.userId }, updateData)
      return { success: true, toolName: this.name, data: { result: '任务已更新' } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}


