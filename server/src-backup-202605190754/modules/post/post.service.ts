import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class PostService {
  async createPost(data: {
    user_id: string
    avatar_id?: string
    content: string
    media_urls?: string[]
    platform?: string
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('posts', {
      id,
      user_id: data.user_id,
      avatar_id: data.avatar_id || null,
      content: data.content,
      media_urls: JSON.stringify(data.media_urls || []),
      platform: data.platform || 'local',
      status: 'published',
      likes_count: 0,
      comments_count: 0,
      shares_count: 0,
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getPosts(userId?: string, page = 1, pageSize = 20) {
    const db = getMySQLClient()
    const filters: any = {}
    if (userId) {
      filters.user_id = userId
    }
    
    const posts = await db.query('posts', filters) as any
    const total = posts?.length || 0
    const offset = (page - 1) * pageSize
    
    return {
      list: posts?.slice(offset, offset + pageSize) || [],
      total,
      page,
      pageSize
    }
  }

  async getPost(postId: string) {
    const db = getMySQLClient()
    return await db.queryOne('posts', { id: postId }) as any
  }

  async deletePost(postId: string, userId: string) {
    const db = getMySQLClient()
    
    const post = await db.queryOne('posts', { id: postId }) as any
    if (!post) {
      throw new Error('帖子不存在')
    }
    
    if (post.user_id !== userId) {
      throw new Error('无权限删除此帖子')
    }
    
    await db.delete('posts', { id: postId })
    
    return { success: true }
  }
}

import * as crypto from 'crypto'
