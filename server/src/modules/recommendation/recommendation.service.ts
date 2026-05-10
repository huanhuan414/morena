// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class RecommendationService {
  async getRecommendations(userId: string, type: string = 'avatar', limit: number = 10, platforms?: string[], contentType?: string) {
    const db = getMySQLClient()
    
    if (type === 'avatar') {
      // 查询活跃的分身
      let sql = 'SELECT * FROM avatars WHERE status = ? ORDER BY updated_at DESC'
      const params: any[] = ['active']
      
      if (limit > 0) {
        sql += ` LIMIT ${parseInt(String(limit))}`
      }
      
      const avatars = await db.query(sql, params) as any[]
      return avatars || []
    }
    
    if (type === 'content') {
      const posts = await db.query('posts', {}) as any[]
      return posts?.slice(0, limit) || []
    }
    
    return []
  }

  async recordRecommendationClick(userId: string, targetId: string, targetType: string) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('recommendations', {
      id,
      user_id: userId,
      target_id: targetId,
      target_type: targetType,
      created_at: new Date()
    })
    
    return { id }
  }
}

import * as crypto from 'crypto'
