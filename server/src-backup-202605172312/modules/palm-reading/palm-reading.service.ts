// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import * as crypto from 'crypto'

export interface PalmReadingRecord {
  id: string
  avatar_id: string | null
  palm_image_url: string
  generated_image_url: string | null
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress: string
  error_message: string | null
  created_at: string
  updated_at: string
}

@Injectable()
export class PalmReadingService {
  private readonly imageApiUrl = 'https://api.aaigc.top/v1/images/edits'
  private readonly imageApiKey = 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK'

  /**
   * 创建任务并异步执行
   */
  async createTask(imageUrl: string, avatarId?: string, userId?: string): Promise<PalmReadingRecord> {
    const db = getMySQLClient()

    const id = crypto.randomUUID()
    await db.insert('palm_reading_records', {
      id,
      avatar_id: avatarId || null,
      user_id: userId || null,
      palm_image_url: imageUrl,
      status: 'pending',
      progress: '任务已创建',
      generated_image_url: null,
      error_message: null,
      created_at: new Date(),
      updated_at: new Date()
    })

    const record = await db.queryOne('palm_reading_records', { id })

    // 异步执行
    this.executeTask(record.id, imageUrl).catch((err) => {
      console.error('[PalmReadingService] 异步任务执行失败:', err.message)
    })

    return record as unknown as PalmReadingRecord
  }

  /**
   * 异步执行生成任务
   */
  private async executeTask(taskId: string, imageUrl: string): Promise<void> {
    const db = getMySQLClient()

    try {
      await this.updateTask(taskId, { status: 'processing', progress: '正在处理图片...' })

      // 模拟处理
      await this.updateTask(taskId, { progress: '图片已就绪，正在生成掌相阅读指南...' })

      // 这里可以添加实际的图片处理逻辑

      await this.updateTask(taskId, {
        status: 'completed',
        progress: '处理完成',
        generated_image_url: imageUrl
      })
    } catch (error) {
      await this.updateTask(taskId, {
        status: 'failed',
        error_message: error.message
      })
    }
  }

  /**
   * 更新任务状态
   */
  private async updateTask(taskId: string, updates: any) {
    const db = getMySQLClient()

    await db.update('palm_reading_records', { id: taskId }, {
      ...updates,
      updated_at: new Date()
    })
  }

  /**
   * 获取任务状态
   */
  async getTask(taskId: string): Promise<PalmReadingRecord | null> {
    const db = getMySQLClient()
    const record = await db.queryOne('palm_reading_records', { id: taskId })
    return record as unknown as PalmReadingRecord | null
  }

  /**
   * 获取用户的所有任务
   */
  async getUserTasks(userId: string): Promise<PalmReadingRecord[]> {
    const db = getMySQLClient()
    const tasks = await db.query('palm_reading_records', { user_id: userId })
    return (tasks || []) as unknown as PalmReadingRecord[]
  }
}
