// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class SocialService {
  async getSocialFeed(userId: string, page = 1, pageSize = 20) {
    const db = getMySQLClient()
    
    const posts = await db.query('posts', {}) as any[]
    const offset = (page - 1) * pageSize
    
    return {
      list: posts?.slice(offset, offset + pageSize) || [],
      page,
      pageSize
    }
  }

  async like(userId: string, targetId: string, targetType: string) {
    const db = getMySQLClient()
    
    const existingLike = await db.queryOne('likes', {
      user_id: userId,
      target_id: targetId,
      target_type: targetType
    }) as any
    
    if (existingLike) {
      await db.delete('likes', { id: existingLike.id })
      
      const table = targetType === 'post' ? 'posts' : 'comments'
      const target = await db.queryOne(table, { id: targetId }) as any
      if (target) {
        await db.updateWhere(table, { id: targetId }, {
          likes_count: Math.max(0, (target.likes_count || 0) - 1)
        })
      }
      
      return { liked: false }
    }
    
    const id = crypto.randomUUID()
    await db.insert('likes', {
      id,
      user_id: userId,
      target_id: targetId,
      target_type: targetType,
      created_at: new Date()
    })
    
    const table = targetType === 'post' ? 'posts' : 'comments'
    const target = await db.queryOne(table, { id: targetId }) as any
    if (target) {
      await db.updateWhere(table, { id: targetId }, {
        likes_count: (target.likes_count || 0) + 1
      })
    }
    
    return { liked: true }
  }

  async follow(followerId: string, followingId: string) {
    const db = getMySQLClient()
    
    const existingFollow = await db.queryOne('follows', {
      follower_id: followerId,
      following_id: followingId
    }) as any
    
    if (existingFollow) {
      await db.delete('follows', { id: existingFollow.id })
      return { followed: false }
    }
    
    const id = crypto.randomUUID()
    await db.insert('follows', {
      id,
      follower_id: followerId,
      following_id: followingId,
      created_at: new Date()
    })
    
    return { followed: true }
  }

  async getComments(targetId: string, page = 1, pageSize = 20) {
    const db = getMySQLClient()
    
    const comments = await db.query('comments', {
      target_id: targetId
    }) as any[]
    const offset = (page - 1) * pageSize
    
    return {
      list: comments?.slice(offset, offset + pageSize) || [],
      page,
      pageSize
    }
  }

  async addComment(data: {
    user_id: string
    target_id: string
    content: string
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('comments', {
      id,
      user_id: data.user_id,
      target_id: data.target_id,
      target_type: 'post',
      content: data.content,
      likes_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    })
    
    const post = await db.queryOne('posts', { id: data.target_id }) as any
    if (post) {
      await db.updateWhere('posts', { id: data.target_id }, {
        comments_count: (post.comments_count || 0) + 1
      })
    }
    
    return { id }
  }
}

import * as crypto from 'crypto'
