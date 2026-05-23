/**
 * 进度缓存服务
 * 用于存储和查询任务执行进度和结果
 */

import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { getMySQLClient } from '../../storage/database/mysql-client'

// 导出任务进度接口
export interface TaskProgress {
  taskId: string
  userId: string
  type: string
  message: string
  data?: any
  timestamp: number
  status?: 'pending' | 'running' | 'completed' | 'failed'
}

// 导出任务结果接口
export interface TaskResult {
  taskId: string
  userId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  createdAt: number
  completedAt?: number
}

@Injectable()
export class ProgressCacheService {
  private readonly logger = new Logger(ProgressCacheService.name)

  // 最大保存的进度条数
  private readonly MAX_PROGRESS_ITEMS = 50
  
  // 进度过期时间（毫秒）
  private readonly EXPIRE_TIME = 24 * 60 * 60 * 1000

  /**
   * 创建任务记录
   */
  createTask(userId: string, taskId: string): TaskResult {
    const db = getMySQLClient()
    const now = Date.now()
    const expiresAt = new Date(now + this.EXPIRE_TIME)
    const result: TaskResult = {
      taskId,
      userId,
      status: 'pending',
      createdAt: now
    }
    db.query(
      `INSERT INTO agent_tasks (task_id, user_id, status, created_at, updated_at, expires_at)
       VALUES (?, ?, 'pending', NOW(), NOW(), ?)
       ON DUPLICATE KEY UPDATE updated_at = NOW(), expires_at = VALUES(expires_at)`,
      [taskId, userId, expiresAt]
    ).catch((err: any) => {
      this.logger.error(`[ProgressCache] 创建任务失败: ${taskId}`, err?.message || err)
    })
    return result
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(userId: string, taskId: string, status: TaskResult['status'], result?: any, error?: string) {
    const db = getMySQLClient()
    const now = Date.now()
    const expiresAt = new Date(now + this.EXPIRE_TIME)
    const shouldSetCompletedAt = status === 'completed' || status === 'failed'
    db.query(
      `UPDATE agent_tasks
       SET status = ?,
           result = ?,
           error = ?,
           completed_at = IF(?, NOW(), completed_at),
           expires_at = ?,
           updated_at = NOW()
       WHERE task_id = ? AND user_id = ?`,
      [
        status,
        result === undefined ? null : JSON.stringify(result),
        error || null,
        shouldSetCompletedAt ? 1 : 0,
        expiresAt,
        taskId,
        userId,
      ]
    ).catch((err: any) => {
      this.logger.error(`[ProgressCache] 更新任务状态失败: ${taskId}`, err?.message || err)
    })
  }

  /**
   * 获取任务结果
   */
  async getTaskResult(userId: string, taskId: string): Promise<TaskResult | null> {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT task_id, user_id, status, result, error,
              UNIX_TIMESTAMP(created_at) * 1000 as created_at_ms,
              UNIX_TIMESTAMP(completed_at) * 1000 as completed_at_ms
       FROM agent_tasks
       WHERE task_id = ? AND user_id = ?
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [taskId, userId]
    )
    const row = (rows as any[])?.[0]
    if (!row) return null
    let parsedResult: any
    if (row.result !== null && row.result !== undefined && row.result !== '') {
      try {
        parsedResult = typeof row.result === 'string' ? JSON.parse(row.result) : row.result
      } catch {
        parsedResult = row.result
      }
    }
    return {
      taskId: row.taskId || row.task_id,
      userId: row.userId || row.user_id,
      status: row.status,
      result: parsedResult,
      error: row.error || undefined,
      createdAt: Number(row.createdAtMs || row.created_at_ms || Date.now()),
      completedAt: row.completedAtMs || row.completed_at_ms || undefined,
    } as any
  }

  /**
   * 获取用户所有任务
   */
  async getUserTasks(userId: string): Promise<TaskResult[]> {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT task_id, user_id, status, result, error,
              UNIX_TIMESTAMP(created_at) * 1000 as created_at_ms,
              UNIX_TIMESTAMP(completed_at) * 1000 as completed_at_ms
       FROM agent_tasks
       WHERE user_id = ?
         AND (expires_at IS NULL OR expires_at > NOW())
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    )
    return (rows || []).map((row: any) => {
      let parsedResult: any
      if (row.result !== null && row.result !== undefined && row.result !== '') {
        try {
          parsedResult = typeof row.result === 'string' ? JSON.parse(row.result) : row.result
        } catch {
          parsedResult = row.result
        }
      }
      return ({
        taskId: row.taskId || row.task_id,
        userId: row.userId || row.user_id,
        status: row.status,
        result: parsedResult,
        error: row.error || undefined,
        createdAt: Number(row.createdAtMs || row.created_at_ms || Date.now()),
        completedAt: row.completedAtMs || row.completed_at_ms || undefined,
      })
    }) as any[]
  }

  /**
   * 更新最新进度
   * 用于在工具执行过程中实时更新进度信息
   */
  updateProgress(userId: string, progress: TaskProgress) {
    this.addProgress(userId, progress)
  }

  /**
   * 添加进度
   */
  addProgress(userId: string, progress: TaskProgress) {
    const db = getMySQLClient()
    const taskId = progress.taskId || 'default'
    const now = Date.now()
    const payload = {
      task_id: taskId,
      user_id: userId,
      type: progress.type || 'info',
      message: progress.message || '',
      data: progress.data === undefined ? null : JSON.stringify(progress.data),
      timestamp_ms: Number(progress.timestamp || now),
      status: progress.status || null,
    }
    db.query(
      `INSERT INTO agent_task_progress (task_id, user_id, type, message, data, timestamp_ms, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        payload.task_id,
        payload.user_id,
        payload.type,
        payload.message,
        payload.data,
        payload.timestamp_ms,
        payload.status,
      ]
    ).catch((err: any) => {
      this.logger.error(`[ProgressCache] 添加进度失败: ${taskId}`, err?.message || err)
    })
    db.query(
      `UPDATE agent_tasks SET updated_at = NOW() WHERE task_id = ? AND user_id = ?`,
      [taskId, userId]
    ).catch(() => {})
  }

  /**
   * 获取进度列表
   * 如果不传 taskId，返回该用户所有任务的进度
   */
  async getProgress(userId: string, taskId?: string): Promise<TaskProgress[]> {
    const db = getMySQLClient()
    if (taskId) {
      const rows = await db.query(
        `SELECT task_id, user_id, type, message, data, timestamp_ms, status
         FROM agent_task_progress
         WHERE user_id = ? AND task_id = ?
         ORDER BY timestamp_ms DESC
         LIMIT ?`,
        [userId, taskId, this.MAX_PROGRESS_ITEMS]
      )
      const list = (rows || []).map((row: any) => {
        let parsedData: any
        if (row.data !== null && row.data !== undefined && row.data !== '') {
          try {
            parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
          } catch {
            parsedData = row.data
          }
        }
        return ({
          taskId: row.taskId || row.task_id,
          userId: row.userId || row.user_id,
          type: row.type,
          message: row.message,
          data: parsedData,
          timestamp: Number(row.timestampMs || row.timestamp_ms || 0),
          status: row.status || undefined,
        })
      })
      return list.reverse()
    }
    const rows = await db.query(
      `SELECT task_id, user_id, type, message, data, timestamp_ms, status
       FROM agent_task_progress
       WHERE user_id = ?
       ORDER BY timestamp_ms DESC
       LIMIT ?`,
      [userId, this.MAX_PROGRESS_ITEMS]
    )
    const list = (rows || []).map((row: any) => {
      let parsedData: any
      if (row.data !== null && row.data !== undefined && row.data !== '') {
        try {
          parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        } catch {
          parsedData = row.data
        }
      }
      return ({
        taskId: row.taskId || row.task_id,
        userId: row.userId || row.user_id,
        type: row.type,
        message: row.message,
        data: parsedData,
        timestamp: Number(row.timestampMs || row.timestamp_ms || 0),
        status: row.status || undefined,
      })
    })
    return list.reverse()
  }

  /**
   * 获取最新进度
   */
  async getLatestProgress(userId: string, taskId?: string): Promise<TaskProgress | null> {
    const db = getMySQLClient()
    if (taskId) {
      const rows = await db.query(
        `SELECT task_id, user_id, type, message, data, timestamp_ms, status
         FROM agent_task_progress
         WHERE user_id = ? AND task_id = ?
         ORDER BY timestamp_ms DESC
         LIMIT 1`,
        [userId, taskId]
      )
      const row = (rows as any[])?.[0]
      if (!row) return null
      let parsedData: any
      if (row.data !== null && row.data !== undefined && row.data !== '') {
        try {
          parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
        } catch {
          parsedData = row.data
        }
      }
      return {
        taskId: row.taskId || row.task_id,
        userId: row.userId || row.user_id,
        type: row.type,
        message: row.message,
        data: parsedData,
        timestamp: Number(row.timestampMs || row.timestamp_ms || 0),
        status: row.status || undefined,
      }
    }
    const rows = await db.query(
      `SELECT task_id, user_id, type, message, data, timestamp_ms, status
       FROM agent_task_progress
       WHERE user_id = ?
       ORDER BY timestamp_ms DESC
       LIMIT 1`,
      [userId]
    )
    const row = (rows as any[])?.[0]
    if (!row) return null
    let parsedData: any
    if (row.data !== null && row.data !== undefined && row.data !== '') {
      try {
        parsedData = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
      } catch {
        parsedData = row.data
      }
    }
    return {
      taskId: row.taskId || row.task_id,
      userId: row.userId || row.user_id,
      type: row.type,
      message: row.message,
      data: parsedData,
      timestamp: Number(row.timestampMs || row.timestamp_ms || 0),
      status: row.status || undefined,
    }
  }

  /**
   * 清除进度
   * 如果不传 taskId，清除该用户所有任务的进度
   */
  clearProgress(userId: string, taskId?: string) {
    const db = getMySQLClient()
    if (taskId) {
      db.query(`DELETE FROM agent_task_progress WHERE user_id = ? AND task_id = ?`, [userId, taskId]).catch(() => {})
      db.query(`DELETE FROM agent_tasks WHERE user_id = ? AND task_id = ?`, [userId, taskId]).catch(() => {})
      return
    }
    db.query(`DELETE FROM agent_task_progress WHERE user_id = ?`, [userId]).catch(() => {})
    db.query(`DELETE FROM agent_tasks WHERE user_id = ?`, [userId]).catch(() => {})
  }

  /**
   * 清理过期进度
   */
  cleanupExpired() {
    const db = getMySQLClient()
    db.query(
      `DELETE p
       FROM agent_task_progress p
       INNER JOIN agent_tasks t ON t.task_id = p.task_id
       WHERE t.expires_at IS NOT NULL AND t.expires_at < NOW()`
    ).catch(() => {})
    db.query(
      `DELETE FROM agent_tasks WHERE expires_at IS NOT NULL AND expires_at < NOW()`
    ).catch(() => {})
  }

  @Cron('*/60 * * * * *')
  cleanupExpiredCron() {
    this.cleanupExpired()
  }
}
