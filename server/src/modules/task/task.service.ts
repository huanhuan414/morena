import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class TaskService {
  async createTask(userId: string, taskData: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .insert({
        user_id: userId,
        avatar_id: taskData.avatar_id,
        title: taskData.title,
        description: taskData.description,
        type: taskData.type || 'general',
        status: 'pending',
        progress: 0,
        result: {},
        metadata: taskData.metadata || {}
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建任务失败: ${error.message}`)
    }
    
    return data
  }

  async getTasks(userId: string, status?: string) {
    const client = getSupabaseClient()
    
    let query = client
      .from('tasks')
      .select('*, avatars(name, avatar_url)')
      .eq('user_id', userId)
    
    if (status) {
      query = query.eq('status', status)
    }
    
    const { data, error } = await query.order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取任务列表失败: ${error.message}`)
    }
    
    return data
  }

  async getTaskById(taskId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .select('*, avatars(name, avatar_url)')
      .eq('id', taskId)
      .single()
    
    if (error) {
      throw new Error(`获取任务详情失败: ${error.message}`)
    }
    
    return data
  }

  async updateTaskProgress(taskId: string, progress: number, status?: string) {
    const client = getSupabaseClient()
    
    const updates: Record<string, any> = {
      progress,
      updated_at: new Date().toISOString()
    }
    
    if (status) {
      updates.status = status
    }
    
    if (progress >= 100) {
      updates.status = 'completed'
      updates.completed_at = new Date().toISOString()
    }
    
    const { data, error } = await client
      .from('tasks')
      .update(updates)
      .eq('id', taskId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新任务进度失败: ${error.message}`)
    }
    
    return data
  }

  async updateTaskResult(taskId: string, result: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .update({
        result,
        status: 'completed',
        progress: 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新任务结果失败: ${error.message}`)
    }
    
    // 增加分身经验
    if (data.avatar_id) {
      await this.addAvatarExp(data.avatar_id, 5)
    }
    
    return data
  }

  async cancelTask(taskId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`取消任务失败: ${error.message}`)
    }
    
    return data
  }

  async retryTask(taskId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('tasks')
      .update({
        status: 'pending',
        progress: 0,
        result: {},
        updated_at: new Date().toISOString()
      })
      .eq('id', taskId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`重试任务失败: ${error.message}`)
    }
    
    return data
  }

  async getTaskStats(userId: string) {
    const client = getSupabaseClient()
    
    const { count: total } = await client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    
    const { count: pending } = await client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'pending')
    
    const { count: inProgress } = await client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'in_progress')
    
    const { count: completed } = await client
      .from('tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    return {
      total: total || 0,
      pending: pending || 0,
      inProgress: inProgress || 0,
      completed: completed || 0
    }
  }

  private async addAvatarExp(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    const { data: avatar } = await client
      .from('avatars')
      .select('exp, level')
      .eq('id', avatarId)
      .single()
    
    if (avatar) {
      const newExp = avatar.exp + exp
      const newLevel = Math.floor(newExp / 100) + 1
      
      await client
        .from('avatars')
        .update({ exp: newExp, level: newLevel })
        .eq('id', avatarId)
    }
  }
}
