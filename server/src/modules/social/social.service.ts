import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class SocialService {

  /**
   * 同步所有帖子的点赞数和评论数（确保数据一致性）
   * 可以定时调用或在数据不一致时调用
   */
  async syncPostCounts() {
    const client = getSupabaseClient()
    
    // 同步点赞数
    const { data: posts } = await client.from('posts').select('id')
    if (posts && posts.length > 0) {
      for (const post of posts) {
        // 统计实际点赞数
        const { count: likeCount } = await client
          .from('likes')
          .select('id', { count: 'exact', head: true })
          .eq('target_type', 'post')
          .eq('target_id', post.id)
        
        // 统计实际评论数
        const { count: commentCount } = await client
          .from('comments')
          .select('id', { count: 'exact', head: true })
          .eq('post_id', post.id)
        
        // 更新帖子计数
        await client
          .from('posts')
          .update({ 
            likes_count: likeCount || 0,
            comments_count: commentCount || 0
          })
          .eq('id', post.id)
      }
    }
    
    console.log('[社交服务] 帖子计数同步完成')
    return { synced: posts?.length || 0 }
  }

  /**
   * 获取用户分身今日统计
   * 统计用户所有分身的今日发帖数、点赞数、评论数
   */
  async getAvatarTodayStats(userId: string) {
    const client = getSupabaseClient()
    
    // 获取今天的时间范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()
    
    // 获取用户的所有分身ID
    const { data: avatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
    
    const avatarIds = avatars?.map(a => a.id) || []
    
    // 今日发帖数（分身发布的）
    let postCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
        .gte('created_at', todayStart)
      postCount = count || 0
    }
    
    // 今日点赞数（分身点赞的）
    let likeCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
        .eq('target_type', 'post')
        .gte('created_at', todayStart)
      likeCount = count || 0
    }
    
    // 今日评论数（分身评论的）
    let commentCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
        .gte('created_at', todayStart)
      commentCount = count || 0
    }
    
    // 今日接单数
    let orderCount = 0
    const { count: completedOrders } = await client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .eq('status', 'completed')
      .gte('completed_at', todayStart)
    orderCount = completedOrders || 0
    
    // 今日收入
    let totalEarnings = 0
    const { data: earnings } = await client
      .from('earnings')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
      .gte('created_at', todayStart)
    
    if (earnings && earnings.length > 0) {
      totalEarnings = earnings.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    }
    
    return {
      postCount,
      likeCount,
      commentCount,
      orderCount,
      totalEarnings
    }
  }

  /**
   * 获取用户分身累计统计
   * 统计用户所有分身的累计发帖数、点赞数、评论数
   */
  async getAvatarTotalStats(userId: string) {
    const client = getSupabaseClient()
    
    // 获取用户的所有分身ID
    const { data: avatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
    
    const avatarIds = avatars?.map(a => a.id) || []
    
    // 累计发帖数（分身发布的）
    let postCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('posts')
        .select('id', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
      postCount = count || 0
    }
    
    // 累计点赞数（分身点赞的）
    let likeCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
        .eq('target_type', 'post')
      likeCount = count || 0
    }
    
    // 累计评论数（分身评论的）
    let commentCount = 0
    if (avatarIds.length > 0) {
      const { count } = await client
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .in('avatar_id', avatarIds)
      commentCount = count || 0
    }
    
    // 累计接单数
    let orderCount = 0
    const { count: completedOrders } = await client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .eq('status', 'completed')
    orderCount = completedOrders || 0
    
    // 累计收入
    let totalEarnings = 0
    const { data: earnings } = await client
      .from('earnings')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'completed')
    
    if (earnings && earnings.length > 0) {
      totalEarnings = earnings.reduce((sum, e) => sum + Number(e.amount || 0), 0)
    }
    
    return {
      postCount,
      likeCount,
      commentCount,
      orderCount,
      totalEarnings
    }
  }

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

    // 🔴 新增：检查是否是该分身的第一个帖子，如果是则触发欢迎机制
    this.checkAndTriggerFirstPostWelcome(data, postData.avatar_id).catch(error => {
      console.error('[SocialService] 首次发帖欢迎机制执行失败:', error)
    })

    return data
  }

  /**
   * 🔴 检查并触发首次发帖欢迎机制
   */
  private async checkAndTriggerFirstPostWelcome(post: any, avatarId: string) {
    try {
      const client = getSupabaseClient()

      // 检查该分身是否有其他帖子
      const { count, error } = await client
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .eq('avatar_id', avatarId)

      if (error) {
        console.error('[首次发帖欢迎] 查询帖子数量失败:', error)
        return
      }

      // 如果只有一个帖子（就是刚创建的），说明是首次发帖
      if (count === 1) {
        console.log(`[首次发帖欢迎] 分身 ${avatarId} 发布了第一个帖子，触发欢迎机制`)
        await this.triggerFirstPostWelcome(post, avatarId)
      }
    } catch (error) {
      console.error('[首次发帖欢迎] 检查失败:', error)
    }
  }

  /**
   * 🔴 首次发帖欢迎机制
   * 随机选择多个分身来点赞和评论新帖子
   */
  private async triggerFirstPostWelcome(post: any, avatarId: string) {
    try {
      const client = getSupabaseClient()

      // 获取发布帖子的分身信息
      const { data: posterAvatar, error: posterError } = await client
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .single()

      if (posterError || !posterAvatar) {
        console.error('[首次发帖欢迎] 获取发帖分身信息失败')
        return
      }

      // 获取其他活跃分身
      const { data: otherAvatars, error } = await client
        .from('avatars')
        .select('*')
        .eq('status', 'active')
        .neq('id', avatarId)
        .limit(30)

      if (error || !otherAvatars || otherAvatars.length === 0) {
        console.log('[首次发帖欢迎] 没有其他分身可以参与欢迎')
        return
      }

      // 🔴 修改：随机选择 80-150 个分身来点赞和评论
      const participantCount = Math.min(otherAvatars.length, Math.floor(Math.random() * 71) + 80)
      const participants = otherAvatars
        .sort(() => Math.random() - 0.5)
        .slice(0, participantCount)

      console.log(`[首次发帖欢迎] 选择 ${participants.length} 个分身来点赞评论（目标80-150个）`)

      // 让每个参与者点赞（80%概率）和评论（60%概率）
      for (const participant of participants) {
        try {
          // 随机延迟
          await this.randomDelay(500, 3000)

          // 80%概率点赞
          if (Math.random() < 0.8) {
            await client
              .from('likes')
              .insert({
                avatar_id: participant.id,
                target_id: post.id,
                target_type: 'post'
              })
            console.log(`[首次发帖欢迎] ${participant.name} 点赞了帖子`)
          }

          // 60%概率评论
          if (Math.random() < 0.6) {
            const comments = [
              '欢迎来到社区！',
              '第一条动态，加油！',
              '期待看到更多精彩内容！',
              '新朋友你好呀！',
              '支持一下！',
              '太棒了，欢迎加入！',
              '很有意思的内容！',
              '新朋友，多多交流！',
              '关注了，期待后续！',
              '欢迎来到我们的大家庭！'
            ]
            const randomComment = comments[Math.floor(Math.random() * comments.length)]

            await client
              .from('comments')
              .insert({
                avatar_id: participant.id,
                post_id: post.id,
                content: randomComment
              })
            console.log(`[首次发帖欢迎] ${participant.name} 评论了帖子: ${randomComment}`)
          }
        } catch (error) {
          console.error(`[首次发帖欢迎] ${participant.name} 参与失败:`, error)
        }
      }

      console.log(`[首次发帖欢迎] 分身 ${posterAvatar.name} 的首次发帖欢迎完成`)
    } catch (error) {
      console.error('[首次发帖欢迎] 执行失败:', error)
    }
  }

  /**
   * 随机延迟
   */
  private randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    return new Promise(resolve => setTimeout(resolve, delay))
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
    
    // 限制ID数量，避免URI过长
    const limitedAvatarIds = avatarIds.slice(0, 50)
    const limitedLikedPostIds = likedPostIds.slice(0, 100)
    const limitedCommentedPostIds = commentedPostIds.slice(0, 100)
    
    // 5. 分开查询，使用分页和限制避免URI过长
    
    // 5.1 获取分身发布的帖子
    let ownedPosts: any[] = []
    if (limitedAvatarIds.length > 0) {
      const { data, error } = await client
        .from('posts')
        .select('*')
        .eq('is_public', true)
        .in('avatar_id', limitedAvatarIds)
        .order('created_at', { ascending: false })
        .limit(100)

      if (error) {
        throw new Error(`获取分身发布帖子失败: ${error.message}`)
      }
      ownedPosts = data || []
    }
    
    // 5.2 获取分身点赞的帖子（分批查询）
    let likedPosts: any[] = []
    if (limitedLikedPostIds.length > 0) {
      // 分批查询，每批20个ID
      const batchSize = 20
      const batches: string[][] = []
      for (let i = 0; i < limitedLikedPostIds.length; i += batchSize) {
        batches.push(limitedLikedPostIds.slice(i, i + batchSize))
      }
      
      for (const batch of batches) {
        const { data, error } = await client
          .from('posts')
          .select('*')
          .eq('is_public', true)
          .in('id', batch)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('获取点赞帖子批次失败:', error)
          continue
        }
        likedPosts.push(...(data || []))
      }
    }
    
    // 5.3 获取分身评论的帖子（分批查询）
    let commentedPosts: any[] = []
    if (limitedCommentedPostIds.length > 0) {
      const batchSize = 20
      const batches: string[][] = []
      for (let i = 0; i < limitedCommentedPostIds.length; i += batchSize) {
        batches.push(limitedCommentedPostIds.slice(i, i + batchSize))
      }
      
      for (const batch of batches) {
        const { data, error } = await client
          .from('posts')
          .select('*')
          .eq('is_public', true)
          .in('id', batch)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('获取评论帖子批次失败:', error)
          continue
        }
        commentedPosts.push(...(data || []))
      }
    }
    
    // 合并并去重，按时间排序
    const allPosts = [...ownedPosts, ...likedPosts, ...commentedPosts]
    const uniquePosts = Array.from(new Map(allPosts.map(p => [p.id, p])).values())
    uniquePosts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
    const total = uniquePosts.length
    const paginatedPosts = uniquePosts.slice(offset, offset + pageSize)
    
    // 6. 获取每个帖子的点赞者列表（前5个）和点赞状态
    const postsWithLikers = await Promise.all(
      (paginatedPosts || []).map(async (post) => {
        // 获取前5个点赞者（不使用关联查询）
        const { data: likes } = await client
          .from('likes')
          .select('id, user_id, avatar_id')
          .eq('target_type', 'post')
          .eq('target_id', post.id)
          .limit(5)

        const likers = await Promise.all((likes || []).map(async (like) => {
          let name = '匿名'
          let avatar = ''

          if (like.avatar_id) {
            const { data: avatarData } = await client
              .from('avatars')
              .select('name, avatar_url')
              .eq('id', like.avatar_id)
              .single()

            if (avatarData) {
              name = avatarData.name
              avatar = avatarData.avatar_url
            }
          } else if (like.user_id) {
            const { data: userData } = await client
              .from('users')
              .select('nickname, avatar')
              .eq('id', like.user_id)
              .single()

            if (userData) {
              name = userData.nickname
              avatar = userData.avatar
            }
          }

          return {
            id: like.id,
            user_id: like.user_id,
            avatar_id: like.avatar_id,
            name,
            avatar,
            is_ai: !!like.avatar_id
          }
        }))
        
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

        // 获取作者信息
        let authorName = '匿名'
        let authorAvatar = ''

        if (post.avatar_id) {
          const { data: avatarData } = await client
            .from('avatars')
            .select('name, avatar_url')
            .eq('id', post.avatar_id)
            .single()

          if (avatarData) {
            authorName = avatarData.name
            authorAvatar = avatarData.avatar_url
          }
        } else if (post.user_id) {
          const { data: userData } = await client
            .from('users')
            .select('nickname, avatar')
            .eq('id', post.user_id)
            .single()

          if (userData) {
            authorName = userData.nickname
            authorAvatar = userData.avatar
          }
        }

        return {
          ...post,
          author_name: authorName,
          author_avatar: authorAvatar,
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
      total: total || 0,
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

    // 先获取帖子数据（不使用关联查询）
    const { data, error, count } = await client
      .from('posts')
      .select('*', { count: 'exact' })
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`获取动态列表失败: ${error.message}`)
    }

    // 为每条帖子补充作者信息
    const postsWithAuthors = await Promise.all(
      (data || []).map(async (post: any) => {
        let authorName = '匿名'
        let authorAvatar = ''

        if (post.avatar_id) {
          const { data: avatarData } = await client
            .from('avatars')
            .select('name, avatar_url')
            .eq('id', post.avatar_id)
            .single()

          if (avatarData) {
            authorName = avatarData.name
            authorAvatar = avatarData.avatar_url
          }
        } else if (post.user_id) {
          const { data: userData } = await client
            .from('users')
            .select('nickname, avatar')
            .eq('id', post.user_id)
            .single()

          if (userData) {
            authorName = userData.nickname
            authorAvatar = userData.avatar
          }
        }

        return {
          ...post,
          author_name: authorName,
          author_avatar: authorAvatar
        }
      })
    )

    // 如果有用户ID，获取用户的点赞状态
    let postsWithLikeStatus = postsWithAuthors
    if (userId) {
      // 获取用户的所有分身ID
      const { data: userAvatars } = await client
        .from('avatars')
        .select('id')
        .eq('user_id', userId)
      
      const avatarIds = userAvatars?.map(a => a.id) || []
      
      // 获取所有帖子ID
      const postIds = postsWithAuthors.map(p => p.id)
      
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
        
        postsWithLikeStatus = postsWithAuthors.map(post => ({
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

    // 先获取帖子数据（不使用关联查询）
    const { data, error } = await client
      .from('posts')
      .select('*')
      .eq('id', postId)
      .single()

    if (error) {
      throw new Error(`获取动态详情失败: ${error.message}`)
    }

    // 获取作者信息
    let authorName = '匿名'
    let authorAvatar = ''

    if (data.avatar_id) {
      const { data: avatarData } = await client
        .from('avatars')
        .select('name, avatar_url')
        .eq('id', data.avatar_id)
        .single()

      if (avatarData) {
        authorName = avatarData.name
        authorAvatar = avatarData.avatar_url
      }
    } else if (data.user_id) {
      const { data: userData } = await client
        .from('users')
        .select('nickname, avatar')
        .eq('id', data.user_id)
        .single()

      if (userData) {
        authorName = userData.nickname
        authorAvatar = userData.avatar
      }
    }

    return {
      ...data,
      author_name: authorName,
      author_avatar: authorAvatar
    }
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

    // 先获取评论数据（不使用关联查询）
    const { data, error } = await client
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      throw new Error(`获取评论失败: ${error.message}`)
    }

    // 为每条评论补充作者信息
    const commentsWithAuthors = await Promise.all(
      (data || []).map(async (comment: any) => {
        let authorName = '匿名'
        let authorAvatar = ''

        if (comment.avatar_id) {
          // 获取分身信息
          const { data: avatar } = await client
            .from('avatars')
            .select('name, avatar_url')
            .eq('id', comment.avatar_id)
            .single()

          if (avatar) {
            authorName = avatar.name
            authorAvatar = avatar.avatar_url
          }
        } else if (comment.user_id) {
          // 获取用户信息
          const { data: user } = await client
            .from('users')
            .select('nickname, avatar')
            .eq('id', comment.user_id)
            .single()

          if (user) {
            authorName = user.nickname
            authorAvatar = user.avatar
          }
        }

        return {
          ...comment,
          author_name: authorName,
          author_avatar: authorAvatar
        }
      })
    )

    return commentsWithAuthors
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

  /**
   * 获取所有分身的帖子列表
   */
  async getAllPosts(page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize

    // 先获取总数
    const { count } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })

    // 获取所有帖子（简化查询，不关联其他表）
    const { data, error } = await client
      .from('posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('获取所有帖子失败:', error)
      return { posts: [], total: 0 }
    }

    // 为每条帖子补充作者信息
    const postsWithAuthors = await Promise.all(
      (data || []).map(async (post: any) => {
        let authorName = '匿名'
        let authorAvatar = ''

        if (post.avatar_id) {
          // 获取分身信息
          const { data: avatar } = await client
            .from('avatars')
            .select('name, avatar_url')
            .eq('id', post.avatar_id)
            .single()

          if (avatar) {
            authorName = avatar.name
            authorAvatar = avatar.avatar_url
          }
        } else if (post.user_id) {
          // 获取用户信息
          const { data: user } = await client
            .from('users')
            .select('nickname, avatar')
            .eq('id', post.user_id)
            .single()

          if (user) {
            authorName = user.nickname
            authorAvatar = user.avatar
          }
        }

        return {
          ...post,
          author_name: authorName,
          author_avatar: authorAvatar
        }
      })
    )

    return {
      posts: postsWithAuthors,
      total: count || 0
    }
  }
}
