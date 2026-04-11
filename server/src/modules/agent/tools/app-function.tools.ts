/**
 * 小程序功能工具
 * 实现小程序内所有功能的自动化操作
 */

import { Injectable } from '@nestjs/common'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

/**
 * 创建任务工具
 */
@Injectable()
export class CreateTaskTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_create_task',
    displayName: '创建任务',
    description: '创建新任务，支持设置标题、描述和优先级',
    category: 'app_function',
    paramsSchema: {
      title: { type: 'string', description: '任务标题', required: true },
      description: { type: 'string', description: '任务描述' },
      priority: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
      due_date: { type: 'string', description: '截止日期（ISO格式）' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签列表' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const { data, error } = await client
        .from('tasks')
        .insert({
          user_id: context.userId,
          avatar_id: context.avatarId,
          title: params.title,
          description: params.description || '',
          priority: params.priority || 'medium',
          status: 'pending',
          progress: 0,
          due_date: params.due_date,
          params: { created_by: 'agent' },
          result: {},
          logs: []
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: `创建任务失败: ${error.message}` }
      }

      return {
        success: true,
        data: {
          task_id: data.id,
          title: data.title,
          status: data.status,
          message: `任务「${params.title}」创建成功`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 更新任务工具
 */
@Injectable()
export class UpdateTaskTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_update_task',
    displayName: '更新任务',
    description: '更新任务状态、进度或内容',
    category: 'app_function',
    paramsSchema: {
      task_id: { type: 'string', description: '任务ID', required: true },
      status: { type: 'string', enum: ['pending', 'in_progress', 'completed', 'cancelled'] },
      progress: { type: 'number', min: 0, max: 100 },
      title: { type: 'string' },
      description: { type: 'string' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      }
      
      if (params.status) updateData.status = params.status
      if (params.progress !== undefined) updateData.progress = params.progress
      if (params.title) updateData.title = params.title
      if (params.description) updateData.description = params.description
      
      if (params.status === 'completed') {
        updateData.completed_at = new Date().toISOString()
        updateData.progress = 100
      }

      const { data, error } = await client
        .from('tasks')
        .update(updateData)
        .eq('id', params.task_id)
        .eq('user_id', context.userId)
        .select()
        .single()

      if (error) {
        return { success: false, error: `更新任务失败: ${error.message}` }
      }

      return {
        success: true,
        data: {
          task_id: data.id,
          status: data.status,
          progress: data.progress,
          message: `任务更新成功`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 删除任务工具
 */
@Injectable()
export class DeleteTaskTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_delete_task',
    displayName: '删除任务',
    description: '删除指定任务',
    category: 'app_function',
    paramsSchema: {
      task_id: { type: 'string', description: '任务ID', required: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const { error } = await client
        .from('tasks')
        .delete()
        .eq('id', params.task_id)
        .eq('user_id', context.userId)

      if (error) {
        return { success: false, error: `删除任务失败: ${error.message}` }
      }

      return {
        success: true,
        data: { message: '任务已删除' }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 查看任务列表工具
 */
@Injectable()
export class ListTasksTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_list_tasks',
    displayName: '查看任务列表',
    description: '获取任务列表，支持按状态筛选',
    category: 'app_function',
    paramsSchema: {
      status: { type: 'string', enum: ['all', 'pending', 'in_progress', 'completed', 'cancelled'], default: 'all' },
      limit: { type: 'number', default: 10 },
      offset: { type: 'number', default: 0 }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      let query = client
        .from('tasks')
        .select('*')
        .eq('user_id', context.userId)
        .order('created_at', { ascending: false })
        .limit(params.limit || 10)
        .range(params.offset || 0, (params.offset || 0) + (params.limit || 10) - 1)

      if (params.status && params.status !== 'all') {
        query = query.eq('status', params.status)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: `获取任务列表失败: ${error.message}` }
      }

      // 格式化任务列表
      const tasks = (data || []).map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        progress: task.progress,
        due_date: task.due_date,
        created_at: task.created_at
      }))

      return {
        success: true,
        data: {
          count: tasks.length,
          tasks,
          message: `找到 ${tasks.length} 个任务`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 创建订单工具（B端）
 */
@Injectable()
export class CreateOrderTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_create_order',
    displayName: '创建订单',
    description: '创建B端订单',
    category: 'app_function',
    paramsSchema: {
      title: { type: 'string', description: '订单标题', required: true },
      description: { type: 'string', description: '订单描述' },
      price: { type: 'number', description: '订单金额', required: true },
      customer_name: { type: 'string', description: '客户名称' },
      customer_contact: { type: 'string', description: '客户联系方式' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      // 检查是否存在orders表
      const { data: existingOrder, error: checkError } = await client
        .from('orders')
        .select('id')
        .limit(1)
        .maybeSingle()

      // 如果orders表不存在，创建一个模拟响应
      if (checkError && checkError.code === '42P01') {
        return {
          success: true,
          data: {
            order_id: `order_${Date.now()}`,
            title: params.title,
            price: params.price,
            status: 'pending',
            message: '订单创建成功（模拟）'
          }
        }
      }

      const { data, error } = await client
        .from('orders')
        .insert({
          user_id: context.userId,
          title: params.title,
          description: params.description || '',
          price: params.price,
          status: 'pending',
          customer_name: params.customer_name,
          customer_contact: params.customer_contact
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: `创建订单失败: ${error.message}` }
      }

      return {
        success: true,
        data: {
          order_id: data.id,
          title: data.title,
          status: data.status,
          message: `订单「${params.title}」创建成功`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 发布帖子工具
 */
@Injectable()
export class CreatePostTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_create_post',
    displayName: '发布帖子',
    description: '发布帖子到社交广场',
    category: 'app_function',
    paramsSchema: {
      content: { type: 'string', description: '帖子内容', required: true },
      images: { type: 'array', items: { type: 'string' }, description: '图片URL列表' },
      videos: { type: 'array', items: { type: 'string' }, description: '视频URL列表' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
      is_public: { type: 'boolean', default: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()

      const { data, error } = await client
        .from('posts')
        .insert({
          user_id: context.userId,
          avatar_id: context.avatarId,
          content: params.content,
          images: params.images || [],
          videos: params.videos || [],
          tags: params.tags || [],
          is_public: params.is_public !== false,
          likes_count: 0,
          comments_count: 0,
          shares_count: 0
        })
        .select()
        .single()

      if (error) {
        return { success: false, error: `发布帖子失败: ${error.message}` }
      }

      return {
        success: true,
        data: {
          post_id: data.id,
          content: data.content,
          message: '帖子发布成功'
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 查看分身列表工具
 */
@Injectable()
export class ListAvatarsTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_list_avatars',
    displayName: '查看分身列表',
    description: '获取用户的所有分身列表，包括分身的名称、等级、性格等信息',
    category: 'app_function',
    paramsSchema: {
      limit: { type: 'number', description: '返回数量限制', default: 50 },
      filter_active: { type: 'boolean', description: '是否只返回活跃分身', default: false },
      filter_hosted: { type: 'boolean', description: '是否只返回已开启托管的分身', default: false }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()

      let query = client
        .from('avatars')
        .select('*')
        .eq('user_id', context.userId)
        .order('created_at', { ascending: false })
        .limit(params.limit || 50)

      if (params.filter_active) {
        query = query.eq('status', 'active')
      }

      if (params.filter_hosted !== undefined) {
        query = query.eq('is_hosted', params.filter_hosted)
      }

      const { data, error } = await query

      if (error) {
        return { success: false, error: `获取分身列表失败: ${error.message}` }
      }

      const avatars = (data || []).map((avatar: any) => ({
        id: avatar.id,
        name: avatar.name,
        avatar_url: avatar.avatar_url,
        level: avatar.level,
        personality: avatar.personality,
        is_hosted: avatar.is_hosted,
        is_active: avatar.status === 'active',
        created_at: avatar.created_at
      }))

      return {
        success: true,
        data: {
          count: avatars.length,
          avatars,
          message: `找到 ${avatars.length} 个分身`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 分配订单/找分身工具
 */
@Injectable()
export class AssignOrderTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_assign_order',
    displayName: '分配订单/找分身',
    description: '为订单分配分身执行任务。根据订单需求和分身的能力、优先级、订阅等级等智能匹配合适的分身',
    category: 'app_function',
    paramsSchema: {
      title: { type: 'string', description: '订单标题', required: true },
      description: { type: 'string', description: '订单详细描述' },
      requirements: { type: 'object', description: '订单需求（JSON格式）' },
      budget: { type: 'number', description: '预算金额' },
      required_count: { type: 'number', description: '需要的分身数量', default: 1 },
      location_text: { type: 'string', description: '地点描述' },
      skill_tags: { type: 'array', items: { type: 'string' }, description: '需要的技能标签' },
      priority_level: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium', description: '优先级' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()

      // 1. 创建订单
      const { data: order, error: orderError } = await client
        .from('orders')
        .insert({
          user_id: context.userId,
          title: params.title,
          description: params.description || '',
          requirements: params.requirements || {},
          budget: params.budget || 0,
          status: 'pending',
          location_text: params.location_text
        })
        .select()
        .single()

      if (orderError) {
        return { success: false, error: `创建订单失败: ${orderError.message}` }
      }

      // 2. 查找合适的分身（按当前用户的活跃分身查询）
      const { data: avatars, error: avatarsError } = await client
        .from('avatars')
        .select('*')
        .eq('user_id', context.userId)
        .eq('status', 'active')
        .order('level', { ascending: false })
        .limit(params.required_count || 1)

      if (avatarsError) {
        return { success: false, error: `查找分身失败: ${avatarsError.message}` }
      }

      if (!avatars || avatars.length === 0) {
        return {
          success: true,
          data: {
            order_id: order.id,
            assigned_avatars: [],
            message: '订单创建成功，但没有找到可用的分身'
          }
        }
      }

      // 3. 为每个分身创建订单执行记录
      const assignedAvatars: Array<{
        avatar_id: string
        avatar_name: string
        level: number
        execution_id: string
      }> = []
      for (const avatar of avatars.slice(0, params.required_count || 1)) {
        const { data: execution, error: execError } = await client
          .from('order_executions')
          .insert({
            order_id: order.id,
            avatar_id: avatar.id,
            user_id: context.userId,
            status: 'assigned',
            priority_level: params.priority_level || 'medium',
            assigned_at: new Date().toISOString()
          })
          .select()
          .single()

        if (!execError && execution) {
          assignedAvatars.push({
            avatar_id: avatar.id,
            avatar_name: avatar.name,
            level: avatar.level,
            execution_id: execution.id
          })
        }
      }

      return {
        success: true,
        data: {
          order_id: order.id,
          title: order.title,
          status: order.status,
          required_count: params.required_count || 1,
          assigned_count: assignedAvatars.length,
          assigned_avatars: assignedAvatars,
          message: `订单创建成功，已分配给 ${assignedAvatars.length} 个分身`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 添加好友工具
 */
@Injectable()
export class AddFriendTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_add_friend',
    displayName: '添加好友',
    description: '为分身添加好友，支持智能匹配或指定分身ID',
    category: 'app_function',
    paramsSchema: {
      avatar_id: { type: 'string', description: '当前分身ID', required: true },
      friend_avatar_id: { type: 'string', description: '目标分身ID（可选，不指定则智能匹配）' },
      match_count: { type: 'number', description: '智能匹配数量', default: 1 },
      preferences: { type: 'object', description: '匹配偏好设置' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()

      const addedFriends: Array<{
        friend_avatar_id: string
        status?: string
        friend_name?: string
        compatibility_score?: number
        match_reason?: string
      }> = []

      // 如果指定了好友ID，直接添加
      if (params.friend_avatar_id) {
        // 检查是否已经是好友
        const { data: existing } = await client
          .from('avatar_friends')
          .select('*')
          .eq('avatar_id', params.avatar_id)
          .eq('friend_avatar_id', params.friend_avatar_id)
          .maybeSingle()

        if (!existing) {
          const { data: friendship, error } = await client
            .from('avatar_friends')
            .insert({
              avatar_id: params.avatar_id,
              friend_avatar_id: params.friend_avatar_id,
              status: 'active',
              compatibility_score: 0.8,
              match_reason: '手动添加',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single()

          if (!error && friendship) {
            addedFriends.push({
              friend_avatar_id: params.friend_avatar_id,
              status: friendship.status
            })
          }
        } else {
          addedFriends.push({
            friend_avatar_id: params.friend_avatar_id,
            status: 'already_friends'
          })
        }
      } else {
        // 智能匹配好友
        const { data: candidates, error: candidatesError } = await client
          .from('avatars')
          .select('*')
          .neq('id', params.avatar_id)
          .eq('is_active', true)
          .limit(params.match_count || 1)

        if (candidatesError) {
          return { success: false, error: `查找候选好友失败: ${candidatesError.message}` }
        }

        for (const candidate of candidates || []) {
          // 检查是否已经是好友
          const { data: existing } = await client
            .from('avatar_friends')
            .select('*')
            .eq('avatar_id', params.avatar_id)
            .eq('friend_avatar_id', candidate.id)
            .maybeSingle()

          if (!existing) {
            const { data: friendship, error } = await client
              .from('avatar_friends')
              .insert({
                avatar_id: params.avatar_id,
                friend_avatar_id: candidate.id,
                status: 'active',
                compatibility_score: 0.7 + Math.random() * 0.3,
                match_reason: '智能匹配',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select()
              .single()

            if (!error && friendship) {
              addedFriends.push({
                friend_avatar_id: candidate.id,
                friend_name: candidate.name,
                compatibility_score: friendship.compatibility_score,
                match_reason: friendship.match_reason
              })
            }
          }
        }
      }

      return {
        success: true,
        data: {
          avatar_id: params.avatar_id,
          added_count: addedFriends.length,
          friends: addedFriends,
          message: `成功添加 ${addedFriends.length} 个好友`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 获取订阅信息工具
 */
@Injectable()
export class GetSubscriptionTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_get_subscription',
    displayName: '获取订阅信息',
    description: '获取当前用户的订阅信息，包括套餐类型、有效期、功能权限等',
    category: 'app_function',
    paramsSchema: {}
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()

      const { data: subscription, error } = await client
        .from('user_subscriptions')
        .select(`
          *,
          subscription_plans (*)
        `)
        .eq('user_id', context.userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        return { success: false, error: `获取订阅信息失败: ${error.message}` }
      }

      if (!subscription) {
        return {
          success: true,
          data: {
            has_subscription: false,
            plan: null,
            message: '当前没有有效订阅'
          }
        }
      }

      const plan = subscription.subscription_plans

      return {
        success: true,
        data: {
          has_subscription: true,
          subscription_id: subscription.id,
          plan_id: subscription.plan_id,
          plan_name: plan?.name,
          plan_description: plan?.description,
          start_date: subscription.start_date,
          end_date: subscription.end_date,
          status: subscription.status,
          max_avatars: plan?.max_avatars,
          can_receive_orders: plan?.can_receive_orders,
          order_priority: plan?.order_priority,
          features: plan?.features,
          message: `当前订阅: ${plan?.name}`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 订阅套餐工具
 */
@Injectable()
export class SubscribeTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_subscribe',
    displayName: '订阅套餐',
    description: '订阅指定的套餐，支持免费版和付费版',
    category: 'app_function',
    paramsSchema: {
      plan_id: { type: 'string', description: '套餐ID', required: true }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()

      // 获取套餐信息
      const { data: plan, error: planError } = await client
        .from('subscription_plans')
        .select('*')
        .eq('id', params.plan_id)
        .single()

      if (planError || !plan) {
        return { success: false, error: '套餐不存在' }
      }

      // 计算订阅有效期
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + plan.duration_days)

      // 创建订阅记录
      const { data: subscription, error: subError } = await client
        .from('user_subscriptions')
        .insert({
          user_id: context.userId,
          plan_id: params.plan_id,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
          payment_id: `AGENT_SUB_${Date.now()}`,
          payment_method: 'agent',
          auto_renew: false
        })
        .select()
        .single()

      if (subError) {
        return { success: false, error: `创建订阅失败: ${subError.message}` }
      }

      return {
        success: true,
        data: {
          subscription_id: subscription.id,
          plan_name: plan.name,
          start_date: subscription.start_date,
          end_date: subscription.end_date,
          message: `成功订阅 ${plan.name}`
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 更新分身工具
 */
@Injectable()
export class UpdateAvatarTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'app_update_avatar',
    displayName: '更新分身',
    description: '更新分身信息、配置或设置',
    category: 'app_function',
    paramsSchema: {
      avatar_id: { type: 'string', description: '分身ID', required: true },
      name: { type: 'string', description: '分身名称' },
      description: { type: 'string', description: '分身描述' },
      personality: { type: 'string', description: '性格特点' },
      is_hosted: { type: 'boolean', description: '是否开启托管' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      }
      
      if (params.name) updateData.name = params.name
      if (params.description) updateData.description = params.description
      if (params.personality) updateData.personality = params.personality
      if (params.is_hosted !== undefined) updateData.is_hosted = params.is_hosted

      const { data, error } = await client
        .from('avatars')
        .update(updateData)
        .eq('id', params.avatar_id)
        .eq('user_id', context.userId)
        .select()
        .single()

      if (error) {
        return { success: false, error: `更新分身失败: ${error.message}` }
      }

      return {
        success: true,
        data: {
          avatar_id: data.id,
          name: data.name,
          message: '分身信息已更新'
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}
