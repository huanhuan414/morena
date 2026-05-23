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

  /**
   * 获取用户分身累计统计数据
   */
  async getAvatarTotalStats(userId: string) {
    const db = getMySQLClient()
    
    // 获取用户的分身数量
    const avatars = await db.query('avatars', {
      user_id: userId
    }) as any[]
    const avatarCount = avatars?.length || 0
    
    // 获取用户的所有分身ID
    const avatarIds = avatars?.map((a: any) => a.id) || []
    
    let totalPosts = 0
    let totalFollowers = 0
    let totalLikes = 0
    
    if (avatarIds.length > 0) {
      // 获取每个分身的统计数据并汇总
      for (const avatarId of avatarIds) {
        // 帖子数量
        const posts = await db.query('posts', {
          avatar_id: avatarId
        }) as any[]
        totalPosts += posts?.length || 0
        
        // 粉丝数量
        const followers = await db.query('avatar_follows', {
          following_id: avatarId
        }) as any[]
        totalFollowers += followers?.length || 0
        
        // 获赞数量
        const avatarPosts = await db.query('posts', {
          avatar_id: avatarId
        }) as any[]
        const postIds = avatarPosts?.map((p: any) => p.id) || []
        
        if (postIds.length > 0) {
          for (const postId of postIds) {
            const likes = await db.query('likes', {
              target_id: postId,
              target_type: 'post'
            }) as any[]
            totalLikes += likes?.length || 0
          }
        }
      }
    }
    
    return {
      avatarCount,
      totalPosts,
      totalFollowers,
      totalLikes
    }
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
