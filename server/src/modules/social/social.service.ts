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

  /**
   * 获取与用户分身相关的帖子
   * 包括：分身发布的、分身点赞的、分身评论过的
   */
  async getAvatarRelatedPosts(userId: string, page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    // 1. 获取用户的所有分身ID
    const { data: avatars, error: avatarError } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
    
    if (avatarError) {
      throw new Error(`获取分身列表失败: ${avatarError.message}`)
    }
    
    const avatarIds = avatars?.map(a => a.id) || []
    
    if (avatarIds.length === 0) {
      return {
        posts: [],
        total: 0,
        page,
        pageSize,
        stats: { postCount: 0, likeCount: 0, commentCount: 0 }
      }
    }
    
    // 2. 获取分身点赞的帖子ID
    const { data: likes } = await client
      .from('likes')
      .select('target_id')
      .in('avatar_id', avatarIds)
      .eq('target_type', 'post')
    
    const likedPostIds = likes?.map(l => l.target_id) || []
    
    // 3. 获取分身评论过的帖子ID
    const { data: comments } = await client
      .from('comments')
      .select('post_id')
      .in('avatar_id', avatarIds)
    
    const commentedPostIds = comments?.map(c => c.post_id) || []
    
    // 4. 合并所有相关帖子ID（分身发布的 + 点赞的 + 评论过的）
    const allRelatedPostIds = [...new Set([
      ...likedPostIds,
      ...commentedPostIds
    ])]
    
    // 5. 查询帖子（分身发布的 OR 相关的帖子）
    let query = client
      .from('posts')
      .select('*, users(nickname, avatar), avatars(name, avatar_url)', { count: 'exact' })
      .eq('is_public', true)
    
    if (allRelatedPostIds.length > 0) {
      // 使用 OR 条件：分身发布的 OR 相关帖子
      query = query.or(`avatar_id.in.(${avatarIds.join(',')}),id.in.(${allRelatedPostIds.join(',')})`)
    } else {
      // 只有分身发布的帖子
      query = query.in('avatar_id', avatarIds)
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取动态列表失败: ${error.message}`)
    }
    
    // 6. 获取每个帖子的点赞者列表（前5个）和点赞状态
    const postsWithLikers = await Promise.all(
      (data || []).map(async (post) => {
        // 获取前5个点赞者
        const { data: likes } = await client
          .from('likes')
          .select('id, user_id, avatar_id, users(nickname, avatar), avatars(name, avatar_url)')
          .eq('target_type', 'post')
          .eq('target_id', post.id)
          .limit(5)
        
        const likers = (likes || []).map(like => {
          const user = Array.isArray(like.users) ? like.users[0] : like.users
          const avatar = Array.isArray(like.avatars) ? like.avatars[0] : like.avatars
          return {
            id: like.id,
            user_id: like.user_id,
            avatar_id: like.avatar_id,
            name: avatar?.name || user?.nickname || '匿名',
            avatar: avatar?.avatar_url || user?.avatar,
            is_ai: !!like.avatar_id
          }
        })
        
        // 单独检查当前用户/分身是否点赞过（不限制数量）
        let isLiked = false
        if (avatarIds.length > 0) {
          const { data: userLike } = await client
            .from('likes')
            .select('id')
            .eq('target_type', 'post')
            .eq('target_id', post.id)
            .in('avatar_id', avatarIds)
            .maybeSingle()
          if (userLike) isLiked = true
        }
        
        // 也检查用户自己的点赞（无分身）
        if (!isLiked) {
          const { data: userLike } = await client
            .from('likes')
            .select('id')
            .eq('target_type', 'post')
            .eq('target_id', post.id)
            .eq('user_id', userId)
            .is('avatar_id', null)
            .maybeSingle()
          if (userLike) isLiked = true
        }
        
        return {
          ...post,
          likers,
          is_liked: isLiked
        }
      })
    )
    
    // 7. 统计数据
    const stats = {
      postCount: avatarIds.length > 0 ? await this.countAvatarPosts(avatarIds) : 0,
      likeCount: likedPostIds.length,
      commentCount: comments?.length || 0
    }
    
    return {
      posts: postsWithLikers || [],
      total: count || 0,
      page,
      pageSize,
      stats
    }
  }

  private async countAvatarPosts(avatarIds: string[]): Promise<number> {
    const client = getSupabaseClient()
    const { count } = await client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
    return count || 0
  }

  async getPosts(page = 1, pageSize = 20, userId?: string) {
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
    
    // 如果有用户ID，获取用户的点赞状态
    let postsWithLikeStatus = data || []
    if (userId) {
      // 获取用户的所有分身ID
      const { data: userAvatars } = await client
        .from('avatars')
        .select('id')
        .eq('user_id', userId)
      
      const avatarIds = userAvatars?.map(a => a.id) || []
      
      // 获取所有帖子ID
      const postIds = (data || []).map(p => p.id)
      
      if (postIds.length > 0) {
        // 查询用户/分身点赞过的帖子
        let likesQuery = client
          .from('likes')
          .select('target_id')
          .eq('target_type', 'post')
          .in('target_id', postIds)
        
        // 检查用户或其分身的点赞
        if (avatarIds.length > 0) {
          likesQuery = likesQuery.or(`user_id.eq.${userId},avatar_id.in.(${avatarIds.join(',')})`)
        } else {
          likesQuery = likesQuery.eq('user_id', userId)
        }
        
        const { data: likes } = await likesQuery
        
        const likedPostIds = new Set(likes?.map(l => l.target_id) || [])
        
        postsWithLikeStatus = (data || []).map(post => ({
          ...post,
          is_liked: likedPostIds.has(post.id)
        }))
      }
    }
    
    return {
      posts: postsWithLikeStatus,
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

  async likePost(userId: string, postId: string, avatarId?: string) {
    const client = getSupabaseClient()
    
    // 获取用户的所有分身ID
    const { data: userAvatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
    
    const avatarIds = userAvatars?.map(a => a.id) || []
    
    // 检查是否已点赞（检查用户或其任何分身）
    // 构建查询条件：avatar_id 在分身列表中，或者 user_id = userId 且 avatar_id 为 null
    let existingLikes: { id: string }[] = []
    
    // 查询分身的点赞
    if (avatarIds.length > 0) {
      const { data } = await client
        .from('likes')
        .select('id')
        .eq('target_type', 'post')
        .eq('target_id', postId)
        .in('avatar_id', avatarIds)
      existingLikes = data || []
    }
    
    // 查询用户自己的点赞（无分身）
    const { data: userOwnLikes } = await client
      .from('likes')
      .select('id')
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .eq('user_id', userId)
      .is('avatar_id', null)
    
    if (userOwnLikes && userOwnLikes.length > 0) {
      existingLikes = [...existingLikes, ...userOwnLikes]
    }
    
    if (existingLikes.length > 0) {
      // 取消点赞 - 删除所有相关的点赞记录
      for (const like of existingLikes) {
        await client.from('likes').delete().eq('id', like.id)
      }
      
      // 减少点赞计数
      const { data: post } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single()
      
      const newCount = Math.max(0, (post?.likes_count || existingLikes.length) - existingLikes.length)
      await client
        .from('posts')
        .update({ likes_count: newCount })
        .eq('id', postId)
      
      return { liked: false }
    } else {
      // 添加点赞 - 使用分身身份
      let finalAvatarId = avatarId
      if (!finalAvatarId && avatarIds.length > 0) {
        finalAvatarId = avatarIds[0]
      }
      
      await client.from('likes').insert({
        user_id: userId,
        avatar_id: finalAvatarId || null,
        target_type: 'post',
        target_id: postId
      })
      
      // 增加点赞计数
      const { data: post } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single()
      
      await client
        .from('posts')
        .update({ likes_count: (post?.likes_count || 0) + 1 })
        .eq('id', postId)
      
      return { liked: true, avatar_id: finalAvatarId }
    }
  }

  async createComment(userId: string, postId: string, content: string, parentId?: string, avatarId?: string) {
    const client = getSupabaseClient()
    
    // 如果没有传入 avatarId，自动获取用户的第一个分身
    let finalAvatarId = avatarId
    if (!finalAvatarId) {
      const { data: userAvatars } = await client
        .from('avatars')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
      
      if (userAvatars && userAvatars.length > 0) {
        finalAvatarId = userAvatars[0].id
      }
    }
    
    const { data, error } = await client
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        avatar_id: finalAvatarId || null,
        content,
        parent_id: parentId
      })
      .select('*, users(nickname, avatar), avatars(name, avatar_url)')
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
      .select('*, users(nickname, avatar), avatars(name, avatar_url)')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取评论失败: ${error.message}`)
    }
    
    return data
  }

  async getLikes(postId: string, page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    // 先获取点赞记录
    const { data: likes, error } = await client
      .from('likes')
      .select('id, user_id, avatar_id')
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取点赞列表失败: ${error.message}`)
    }
    
    if (!likes || likes.length === 0) {
      return []
    }
    
    // 获取用户和分身信息
    const userIds = likes.filter(l => l.user_id).map(l => l.user_id)
    const avatarIds = likes.filter(l => l.avatar_id).map(l => l.avatar_id)
    
    const [usersResult, avatarsResult] = await Promise.all([
      userIds.length > 0 
        ? client.from('users').select('id, nickname, avatar').in('id', userIds)
        : { data: [] },
      avatarIds.length > 0
        ? client.from('avatars').select('id, name, avatar_url').in('id', avatarIds)
        : { data: [] }
    ])
    
    const usersMap = new Map((usersResult.data || []).map((u: any) => [u.id, u]))
    const avatarsMap = new Map((avatarsResult.data || []).map((a: any) => [a.id, a]))
    
    // 组装结果
    return likes.map(like => {
      const user = usersMap.get(like.user_id)
      const avatar = avatarsMap.get(like.avatar_id)
      return {
        id: like.id,
        user_id: like.user_id,
        avatar_id: like.avatar_id,
        name: avatar?.name || user?.nickname || '匿名',
        avatar: avatar?.avatar_url || user?.avatar,
        is_ai: !!like.avatar_id
      }
    })
  }

  async getFollowersAndFollowing(userId: string) {
    const client = getSupabaseClient()
    
    // 获取粉丝列表（关注了我的人）
    const { data: followersData, error: followersError } = await client
      .from('follows')
      .select('follower_id, created_at')
      .eq('following_id', userId)
      .order('created_at', { ascending: false })
    
    if (followersError) {
      throw new Error(`获取粉丝列表失败: ${followersError.message}`)
    }
    
    // 获取关注列表（我关注的人）
    const { data: followingData, error: followingError } = await client
      .from('follows')
      .select('following_id, created_at')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
    
    if (followingError) {
      throw new Error(`获取关注列表失败: ${followingError.message}`)
    }
    
    // 获取粉丝用户信息
    const followerIds = (followersData || []).map((item: any) => item.follower_id)
    const { data: followerUsers } = followerIds.length > 0 
      ? await client.from('users').select('id, nickname, avatar_url').in('id', followerIds)
      : { data: [] }
    
    // 获取关注用户信息
    const followingIds = (followingData || []).map((item: any) => item.following_id)
    const { data: followingUsers } = followingIds.length > 0
      ? await client.from('users').select('id, nickname, avatar_url').in('id', followingIds)
      : { data: [] }
    
    // 创建用户映射
    const userMap = new Map<string, any>()
    ;(followerUsers || []).forEach((u: any) => userMap.set(u.id, u))
    ;(followingUsers || []).forEach((u: any) => userMap.set(u.id, u))
    
    // 格式化粉丝列表
    const followers = (followersData || []).map((item: any) => {
      const user = userMap.get(item.follower_id) || {}
      return {
        id: item.follower_id,
        nickname: user.nickname || '未知用户',
        avatar: user.avatar_url,
        isAi: false,
        followedAt: item.created_at
      }
    })
    
    // 格式化关注列表
    const following = (followingData || []).map((item: any) => {
      const user = userMap.get(item.following_id) || {}
      return {
        id: item.following_id,
        nickname: user.nickname || '未知用户',
        avatar: user.avatar_url,
        isAi: false,
        followedAt: item.created_at
      }
    })
    
    return { followers, following }
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

  async sharePost(userId: string, postId: string) {
    const client = getSupabaseClient()
    
    // 增加分享计数
    const { data: post } = await client
      .from('posts')
      .select('shares_count')
      .eq('id', postId)
      .single()
    
    await client
      .from('posts')
      .update({ shares_count: (post?.shares_count || 0) + 1 })
      .eq('id', postId)
    
    return { shared: true, shares_count: (post?.shares_count || 0) + 1 }
  }
}
