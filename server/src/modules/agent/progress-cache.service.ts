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
   */
  getProgress(userId: string, taskId?: string): TaskProgress[] {
    const key = `${userId}:${taskId || 'default'}`
    return this.progressMap.get(key) || []
  }

  /**
   * 获取最新进度
   */
  getLatestProgress(userId: string, taskId?: string): TaskProgress | null {
    const key = `${userId}:${taskId || 'default'}`
    const progressList = this.progressMap.get(key)
    
    if (!progressList || progressList.length === 0) {
      return null
    }
    
    return progressList[progressList.length - 1]
  }

  /**
   * 清除进度
   */
  clearProgress(userId: string, taskId?: string) {
    const key = `${userId}:${taskId || 'default'}`
    this.progressMap.delete(key)
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
