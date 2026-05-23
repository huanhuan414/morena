/**
 * 小程序功能工具
 * 实现小程序内所有功能的自动化操作
 */

import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import * as crypto from 'crypto'

// 创建任务工具
export class CreateTaskTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_create_task',
    displayName: '创建任务',
    description: '创建新任务，支持设置标题、描述和优先级',
    category: 'app_function',
    paramsSchema: {
      title: { type: 'string', description: '任务标题', required: true },
      description: { type: 'string', description: '任务描述' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      
      await db.query(
        `INSERT INTO tasks (id, user_id, avatar_id, title, description, priority, status, progress, params, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, NOW(), NOW())`,
        [id, context.userId, context.avatarId || '', params.title, params.description || '', params.priority || 'medium', JSON.stringify({ created_by: 'agent' })]
      )

      return {
        success: true,
        data: { task_id: id, title: params.title, status: 'pending', message: `任务「${params.title}」创建成功` }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 更新任务工具
export class UpdateTaskTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_update_task',
    displayName: '更新任务',
    description: '更新任务状态、进度或内容',
    category: 'app_function',
    paramsSchema: {
      task_id: { type: 'string', description: '任务ID', required: true },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
      progress: { type: 'number', min: 0, max: 100 }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const fields: string[] = ['updated_at = NOW()']
      const values: any[] = []
      
      if (params.status) {
        fields.push('status = ?')
        values.push(params.status)
      }
      if (params.progress !== undefined) {
        fields.push('progress = ?')
        values.push(params.progress)
      }
      
      values.push(params.task_id)
      
      await db.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, [...values, context.userId])
      return { success: true, data: { task_id: params.task_id, message: '任务更新成功' } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 删除任务工具
export class DeleteTaskTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_delete_task',
    displayName: '删除任务',
    description: '删除指定任务',
    category: 'app_function',
    paramsSchema: { task_id: { type: 'string', description: '任务ID', required: true } }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      await db.query(`DELETE FROM tasks WHERE id = ? AND user_id = ?`, [params.task_id, context.userId])
      return { success: true, data: { message: '任务删除成功' } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 列出任务工具
export class ListTasksTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_list_tasks',
    displayName: '列出任务',
    description: '列出用户的所有任务',
    category: 'app_function',
    paramsSchema: {}
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const result = await db.query(`SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, [context.userId])
      return { success: true, data: { tasks: result.data || [] } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 创建订单工具
export class CreateOrderTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_create_order',
    displayName: '创建订单',
    description: '创建新订单',
    category: 'app_function',
    paramsSchema: {
      title: { type: 'string', description: '订单标题', required: true },
      description: { type: 'string', description: '订单描述' },
      budget: { type: 'number', description: '预算' },
      platforms: { type: 'array', items: { type: 'string' }, description: '目标平台' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      const platforms = Array.isArray(params.platforms) ? params.platforms.join(',') : (params.platforms || '')
      
      await db.query(
        `INSERT INTO orders (id, user_id, title, description, budget, platforms, status, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
        [id, context.userId, params.title, params.description || '', params.budget || 0, platforms]
      )

      return { success: true, data: { order_id: id, title: params.title, message: `订单「${params.title}」创建成功` } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 创建帖子工具
export class CreatePostTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_create_post',
    displayName: '创建帖子',
    description: '创建新帖子',
    category: 'app_function',
    paramsSchema: {
      content: { type: 'string', description: '帖子内容', required: true },
      images: { type: 'array', items: { type: 'string' }, description: '图片URL列表' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const id = `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
      const images = Array.isArray(params.images) ? params.images.join(',') : ''
      
      await db.query(
        `INSERT INTO posts (id, user_id, avatar_id, content, images, likes_count, comments_count, shares_count, status, created_at) 
         VALUES (?, ?, ?, ?, ?, 0, 0, 0, 'active', NOW())`,
        [id, context.userId, context.avatarId || '', params.content, images]
      )

      return { success: true, data: { post_id: id, message: '帖子发布成功' } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 更新分身工具
export class UpdateAvatarTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_update_avatar',
    displayName: '更新分身',
    description: '更新分身信息',
    category: 'app_function',
    paramsSchema: {
      avatar_id: { type: 'string', description: '分身ID', required: true },
      name: { type: 'string', description: '分身名称' },
      personality: { type: 'string', description: '分身性格' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const fields: string[] = ['updated_at = NOW()']
      const values: any[] = []
      
      if (params.name) {
        fields.push('name = ?')
        values.push(params.name)
      }
      if (params.personality) {
        fields.push('personality = ?')
        values.push(params.personality)
      }
      
      values.push(params.avatar_id)
      
      await db.query(`UPDATE avatars SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, [...values, context.userId])
      return { success: true, data: { message: '分身更新成功' } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 列出分身工具
export class ListAvatarsTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_list_avatars',
    displayName: '列出分身',
    description: '列出用户的所有分身',
    category: 'app_function',
    paramsSchema: {}
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const result = await db.query(`SELECT * FROM avatars WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, [context.userId])
      return { success: true, data: { avatars: result.data || [] } }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

// 占位工具（用于缺失的功能）
export class AssignOrderTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_assign_order',
    displayName: '分配订单',
    description: '分配订单给指定分身',
    category: 'app_function',
    paramsSchema: {
      order_id: { type: 'string', description: '订单ID', required: true },
      avatar_id: { type: 'string', description: '分身ID', required: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    return { success: true, data: { message: '订单分配功能暂不可用' } }
  }
}

export class AddFriendTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_add_friend',
    displayName: '添加好友',
    description: '向指定用户发送好友申请',
    category: 'app_function',
    paramsSchema: {
      user_id: { type: 'string', description: '用户ID', required: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    return { success: true, data: { message: '添加好友功能暂不可用' } }
  }
}

export class ListUserFriendsTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_list_friends',
    displayName: '列出好友',
    description: '列出用户的所有好友',
    category: 'app_function',
    paramsSchema: {}
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    return { success: true, data: { friends: [] } }
  }
}

export class ListFriendsTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_list_avatar_friends',
    displayName: '列出分身好友',
    description: '列出分身的所有好友',
    category: 'app_function',
    paramsSchema: { avatar_id: { type: 'string', description: '分身ID' } }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    return { success: true, data: { friends: [] } }
  }
}

export class GetSubscriptionTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_get_subscription',
    displayName: '获取订阅信息',
    description: '获取用户的订阅信息',
    category: 'app_function',
    paramsSchema: {}
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    return { success: true, data: { subscription: null, message: '订阅功能暂不可用' } }
  }
}

export class SubscribeTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_subscribe',
    displayName: '订阅',
    description: '订阅高级功能',
    category: 'app_function',
    paramsSchema: {
      plan_id: { type: 'string', description: '套餐ID', required: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    return { success: true, data: { message: '订阅功能暂不可用' } }
  }
}
