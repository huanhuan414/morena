/**
 * 进度缓存服务
 * 用于存储和查询任务执行进度
 */

import { Injectable } from '@nestjs/common'

// 导出任务进度接口
export interface TaskProgress {
  taskId: string
  userId: string
  type: string
  message: string
  data?: any
  timestamp: number
}

@Injectable()
export class ProgressCacheService {
  // 存储任务进度：key = userId:taskId
  private progressMap: Map<string, TaskProgress[]> = new Map()
  
  // 最大保存的进度条数
  private readonly MAX_PROGRESS_ITEMS = 50
  
  // 进度过期时间（毫秒）
  private readonly EXPIRE_TIME = 5 * 60 * 1000 // 5分钟

  /**
   * 添加进度
   */
  addProgress(userId: string, progress: TaskProgress) {
    const key = `${userId}:${progress.taskId || 'default'}`
    
    if (!this.progressMap.has(key)) {
      this.progressMap.set(key, [])
    }
    
    const progressList = this.progressMap.get(key)!
    progressList.push(progress)
    
    // 限制最大条数
    if (progressList.length > this.MAX_PROGRESS_ITEMS) {
      progressList.shift()
    }
    
    console.log(`[ProgressCache] 添加进度: ${key}`, progress.type, progress.message)
  }

  /**
   * 获取进度列表
   * 如果不传 taskId，返回该用户所有任务的进度
   */
  getProgress(userId: string, taskId?: string): TaskProgress[] {
    if (taskId) {
      // 指定了 taskId，直接返回对应的进度
      const key = `${userId}:${taskId}`
      return this.progressMap.get(key) || []
    }
    
    // 没有指定 taskId，返回该用户所有任务的进度（按时间排序）
    const allProgress: TaskProgress[] = []
    this.progressMap.forEach((progressList, key) => {
      if (key.startsWith(`${userId}:`)) {
        allProgress.push(...progressList)
      }
    })
    
    // 按时间戳排序
    return allProgress.sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * 获取最新进度
   */
  getLatestProgress(userId: string, taskId?: string): TaskProgress | null {
    if (taskId) {
      const key = `${userId}:${taskId}`
      const progressList = this.progressMap.get(key)
      if (!progressList || progressList.length === 0) {
        return null
      }
      return progressList[progressList.length - 1]
    }
    
    // 没有指定 taskId，返回该用户所有任务中最新的进度
    let latest: TaskProgress | null = null
    this.progressMap.forEach((progressList, key) => {
      if (key.startsWith(`${userId}:`) && progressList.length > 0) {
        const last = progressList[progressList.length - 1]
        if (!latest || last.timestamp > latest.timestamp) {
          latest = last
        }
      }
    })
    return latest
  }

  /**
   * 清除进度
   * 如果不传 taskId，清除该用户所有任务的进度
   */
  clearProgress(userId: string, taskId?: string) {
    if (taskId) {
      const key = `${userId}:${taskId}`
      this.progressMap.delete(key)
    } else {
      // 清除该用户所有任务的进度
      const keysToDelete: string[] = []
      this.progressMap.forEach((_, key) => {
        if (key.startsWith(`${userId}:`)) {
          keysToDelete.push(key)
        }
      })
      keysToDelete.forEach(key => this.progressMap.delete(key))
      console.log(`[ProgressCache] 清除用户 ${userId} 的所有进度，共 ${keysToDelete.length} 个任务`)
    }
  }

  /**
   * 清理过期进度
   */
  cleanupExpired() {
    const now = Date.now()
    
    this.progressMap.forEach((progressList, key) => {
      const latestProgress = progressList[progressList.length - 1]
      if (latestProgress && now - latestProgress.timestamp > this.EXPIRE_TIME) {
        this.progressMap.delete(key)
        console.log(`[ProgressCache] 清理过期进度: ${key}`)
      }
    })
  }
}
