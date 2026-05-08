import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class TaskService {
  async createTask(userId: string, data: {
    avatar_id?: string
    type: string
    config?: Record<string, any>
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('tasks', {
      id,
      user_id: userId,
      avatar_id: data.avatar_id || null,
      type: data.type,
      status: 'pending',
      config: JSON.stringify(data.config || {}),
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getTasks(userId: string, status?: string) {
    const db = getMySQLClient()
    const filters: any = { user_id: userId }
    if (status) {
      filters.status = status
    }
    
    return await db.query('tasks', filters) as any[]
  }

  async getTask(taskId: string) {
    const db = getMySQLClient()
    return await db.queryOne('tasks', { id: taskId }) as any
  }

  async updateTaskStatus(taskId: string, status: string, result?: Record<string, any>) {
    const db = getMySQLClient()
    
    const updateData: any = {
      status,
      updated_at: new Date()
    }
    
    if (result) {
      updateData.result = JSON.stringify(result)
    }
    
    await db.updateWhere('tasks', { id: taskId }, updateData)
    
    return { success: true }
  }

  async getTaskStats(userId: string) {
    const db = getMySQLClient()
    const tasks = await db.query('tasks', { user_id: userId }) as any[]
    
    const stats = {
      total: tasks?.length || 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    }
    
    if (tasks) {
      tasks.forEach((task: any) => {
        if (task.status === 'pending') stats.pending++
        else if (task.status === 'processing') stats.processing++
        else if (task.status === 'completed') stats.completed++
        else if (task.status === 'failed') stats.failed++
      })
    }
    
    return stats
  }
}

import * as crypto from 'crypto'
