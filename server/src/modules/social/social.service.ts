import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class SocialService {
  async createPost(userId: string, postData: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('posts')
      .insert({
        user_id: userId,
        avatar_id: postData.avatar_id,
        content: postData.content,
        images: postData.images || [],
        videos: postData.videos || [],
        tags: postData.tags || [],
        is_public: postData.is_public ?? true
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`发布动态失败: ${error.message}`)
    }
    
    return data
  }

  async getPosts(page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    const { data, error, count } = await client
      .from('posts')
      .select('*, users(nickname, avatar), avatars(name, avatar_url)', { count: 'exact' })
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取动态列表失败: ${error.message}`)
    }
    
    return {
      posts: data,
      total: count || 0,
      page,
      pageSize
    }
  }

  async getPostById(postId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('posts')
      .select('*, users(nickname, avatar), avatars(name, avatar_url)')
      .eq('id', postId)
      .single()
    
    if (error) {
      throw new Error(`获取动态详情失败: ${error.message}`)
    }
    
    return data
  }

  async deletePost(postId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除动态失败: ${error.message}`)
    }
    
    return { success: true }
  }

  async likePost(userId: string, postId: string) {
    const client = getSupabaseClient()
    
    // 检查是否已点赞
    const { data: existingLike } = await client
      .from('likes')
      .select('id')
      .eq('user_id', userId)
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .maybeSingle()
    
    if (existingLike) {
      // 取消点赞
      await client.from('likes').delete().eq('id', existingLike.id)
      
      // 减少点赞计数
      const { data: post } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single()
      
      await client
        .from('posts')
        .update({ likes_count: Math.max(0, (post?.likes_count || 1) - 1) })
        .eq('id', postId)
      
      return { liked: false }
    } else {
      // 添加点赞
      await client.from('likes').insert({
        user_id: userId,
        target_type: 'post',
        target_id: postId
      })
      
      // 增加点赞计数
      await client.rpc('increment_likes', { post_id: postId })
      
      return { liked: true }
    }
  }

  async createComment(userId: string, postId: string, content: string, parentId?: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        content,
        parent_id: parentId
      })
      .select('*, users(nickname, avatar)')
      .single()
    
    if (error) {
      throw new Error(`发布评论失败: ${error.message}`)
    }
    
    // 增加评论计数
    const { data: post } = await client
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .single()
    
    await client
      .from('posts')
      .update({ comments_count: (post?.comments_count || 0) + 1 })
      .eq('id', postId)
    
    return data
  }

  async getComments(postId: string, page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    const { data, error } = await client
      .from('comments')
      .select('*, users(nickname, avatar)')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取评论失败: ${error.message}`)
    }
    
    return data
  }

  async followUser(userId: string, targetUserId: string) {
    const client = getSupabaseClient()
    
    if (userId === targetUserId) {
      throw new Error('不能关注自己')
    }
    
    // 检查是否已关注
    const { data: existingFollow } = await client
      .from('follows')
      .select('id')
      .eq('follower_id', userId)
      .eq('following_id', targetUserId)
      .maybeSingle()
    
    if (existingFollow) {
      // 取消关注
      await client.from('follows').delete().eq('id', existingFollow.id)
      return { following: false }
    } else {
      // 关注
      await client.from('follows').insert({
        follower_id: userId,
        following_id: targetUserId
      })
      return { following: true }
    }
  }

  async getUserPosts(userId: string, page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    const { data, error } = await client
      .from('posts')
      .select('*, avatars(name, avatar_url)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取用户动态失败: ${error.message}`)
    }
    
    return data
  }
}
