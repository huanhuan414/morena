// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class RecommendationService {
  async getRecommendations(userId: string, type: string = 'avatar') {
    const db = getMySQLClient()
    
    if (type === 'avatar') {
      const avatars = await db.query('avatars', {}) as any[]
      return avatars?.slice(0, 10) || []
    }
    
    if (type === 'content') {
      const posts = await db.query('posts', {}) as any[]
      return posts?.slice(0, 10) || []
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
