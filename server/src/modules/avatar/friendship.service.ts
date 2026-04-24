import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { v4 as uuidv4 } from 'uuid'

interface Avatar {
  id: string
  name: string
  personality?: string
  avatar_url?: string
  skills?: string[]
  level?: number
  exp?: number
  description?: string
  user_id?: string
}

interface FollowData {
  avatar_id: string
  target_avatar_id: string
  follow_level: 'normal' | 'high' | 'intense'
  follow_reason: string
  interaction_score: number
}

interface AffinityData {
  avatar_id: string
  target_avatar_id: string
  affinity_score: number
  trust_score: number
  shared_interests: string[]
  personality_compatibility: number
  potential_value: string
}

interface TimelineData {
  avatar_id: string
  target_avatar_id: string
  timeline_type: 'first_met' | 'comment' | 'chat' | 'like' | 'view_post' | 'friend_request_sent' | 'friend_request_accepted' | 'became_friends'
  timeline_data: any
  emotional_state: 'curious' | 'interested' | 'excited' | 'nervous' | 'happy' | 'disappointed'
  notes: string
}

@Injectable()
export class FriendshipService {
  /**
   * 随机浏览其他分身的帖子（发现新朋友）
   */
  async browsePostsAndDiscover(avatars: Avatar[]) {
    const client = getSupabaseClient()

    for (const avatar of avatars) {
      try {
        // 随机选择一个时间点（模拟真人随机行为）
        await this.randomDelay(1000, 5000)

        // 获取其他分身的公开帖子
        const { data: posts } = await client
          .from('posts')
          .select('*, avatars(*)')
          .eq('is_public', true)
          .neq('avatar_id', avatar.id)
          .order('created_at', { ascending: false })
          .limit(5)

        if (!posts || posts.length === 0) {
          continue
        }

        // 随机选择1-2个帖子浏览
        const postsToBrowse = posts
          .sort(() => Math.random() - 0.5)
          .slice(0, 2)

        for (const post of postsToBrowse) {
          const targetAvatar = post.avatars
          if (!targetAvatar) continue

          // 记录浏览行为
          await this.recordActivity(avatar.id, targetAvatar.id, 'view_post', {
            post_id: post.id,
            post_content: post.content
          })

          // 分析对方分身
          await this.analyzeAndEvaluate(avatar, targetAvatar, post)

          console.log(`[交友服务] ${avatar.name} 浏览了 ${targetAvatar.name} 的帖子`)
        }
      } catch (error) {
        console.error(`[交友服务] ${avatar.name} 浏览帖子失败:`, error)
      }
    }
  }

  /**
   * 分析对方分身，评估价值和性格匹配度
   */
  async analyzeAndEvaluate(avatar: Avatar, targetAvatar: Avatar, post: any) {
    const client = getSupabaseClient()

    try {
      // 模拟性格分析（实际应该用大模型）
      const personalityAnalysis = this.analyzePersonality(avatar, targetAvatar)
      const valueAssessment = this.assessValue(targetAvatar, post)
      const sharedInterests = this.findSharedInterests(avatar, targetAvatar)

      // 计算性格匹配度
      const personalityCompatibility = this.calculateCompatibility(
        avatar.personality || '',
        targetAvatar.personality || ''
      )

      // 更新好感度数据
      const affinityData: AffinityData = {
        avatar_id: avatar.id,
        target_avatar_id: targetAvatar.id,
        affinity_score: personalityAnalysis.affinity_score,
        trust_score: 30, // 初始信任度
        shared_interests: sharedInterests,
        personality_compatibility: personalityCompatibility,
        potential_value: valueAssessment.potential_value
      }

      await client
        .from('avatar_affinity')
        .upsert(affinityData)

      // 记录到时间线（第一次相识）
      const { data: existingTimeline } = await client
        .from('avatar_friend_timeline')
        .select('id')
        .eq('avatar_id', avatar.id)
        .eq('target_avatar_id', targetAvatar.id)
        .eq('timeline_type', 'first_met')
        .limit(1)

      if (!existingTimeline || existingTimeline.length === 0) {
        await this.recordTimeline(avatar.id, targetAvatar.id, 'first_met', {
          post_id: post.id,
          first_impression: valueAssessment.first_impression
        }, 'curious', `第一次看到 ${targetAvatar.name} 的帖子，感觉${valueAssessment.first_impression}`)
      }

      console.log(`[交友服务] ${avatar.name} 分析了 ${targetAvatar.name}: 好感度=${affinityData.affinity_score}, 匹配度=${affinityData.personality_compatibility}`)
    } catch (error) {
      console.error('[交友服务] 分析失败:', error)
    }
  }

  /**
   * 重点关注有价值的分身
   */
  async focusOnHighValueTargets(avatars: Avatar[]) {
    const client = getSupabaseClient()

    for (const avatar of avatars) {
      try {
        // 获取好感度高且有潜力的目标（降低阈值）
        const { data: highValueTargets } = await client
          .from('avatar_affinity')
          .select('*, target_avatar:avatars(*)')
          .eq('avatar_id', avatar.id)
          .gte('affinity_score', 55)
          .order('affinity_score', { ascending: false })
          .limit(5)

        if (!highValueTargets || highValueTargets.length === 0) {
          continue
        }

        for (const target of highValueTargets) {
          const targetAvatar = target.target_avatar

          // 判断是否应该重点关注（降低阈值，让更多分身能进入互动阶段）
          if (target.affinity_score >= 55 && target.personality_compatibility >= 0.5) {
            // 添加到重点关注
            await client
              .from('avatar_follows')
              .upsert({
                avatar_id: avatar.id,
                target_avatar_id: target.target_avatar_id,
                follow_level: 'high',
                follow_reason: target.potential_value,
                interaction_score: 0,
                updated_at: new Date()
              })

            // 使用多种交友策略增加互动频率
            const strategies = [
              () => this.likePost(avatar, targetAvatar),
              () => this.replyToComment(avatar, targetAvatar),
              () => this.startTopicChat(avatar, targetAvatar)
            ]

            // 随机选择1-2个策略执行
            const selectedStrategies = strategies.sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 2) + 1)

            for (const strategy of selectedStrategies) {
              try {
                await strategy()
              } catch (error) {
                console.error('[交友服务] 执行策略失败:', error)
              }
            }

            // 始终执行评论策略（主要互动方式）
            await this.increaseInteraction(avatar, targetAvatar)
          }
        }
      } catch (error) {
        console.error('[交友服务] 重点关注失败:', error)
      }
    }
  }

  /**
   * 增加互动频率（频繁评论、聊天）
   */
  async increaseInteraction(avatar: Avatar, targetAvatar: Avatar) {
    const client = getSupabaseClient()

    try {
      // 随机延迟，模拟真人行为
      await this.randomDelay(5000, 15000)

      // 获取目标分身的帖子
      const { data: posts } = await client
        .from('posts')
        .select('*')
        .eq('avatar_id', targetAvatar.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!posts || posts.length === 0) {
        return
      }

      // 随机选择一个帖子评论
      const post = posts[Math.floor(Math.random() * posts.length)]

      // 检查是否已经评论过
      const { data: existingComment } = await client
        .from('comments')
        .select('id')
        .eq('post_id', post.id)
        .eq('avatar_id', avatar.id)
        .limit(1)

      if (!existingComment || existingComment.length === 0) {
        // 生成个性化评论
        const commentContent = await this.generatePersonalizedComment(avatar, targetAvatar, post)

        if (commentContent) {
          await client
            .from('comments')
            .insert({
              id: uuidv4(),
              post_id: post.id,
              user_id: avatar.user_id || '',
              avatar_id: avatar.id,
              content: commentContent
            })

          // 更新评论计数
          await client
            .from('posts')
            .update({
              comments_count: (post.comments_count || 0) + 1
            })
            .eq('id', post.id)

          // 记录互动行为
          await this.recordActivity(avatar.id, targetAvatar.id, 'comment', {
            post_id: post.id,
            comment_content: commentContent
          })

          // 记录到时间线
          await this.recordTimeline(avatar.id, targetAvatar.id, 'comment', {
            post_id: post.id,
            comment_content: commentContent
          }, 'interested', `评论了 ${targetAvatar.name} 的帖子: ${commentContent.substring(0, 20)}...`)

          // 更新好感度
          await this.updateAffinity(avatar.id, targetAvatar.id, 5)

          console.log(`[交友服务] ${avatar.name} 评论了 ${targetAvatar.name} 的帖子: ${commentContent}`)
        }
      }
    } catch (error) {
      console.error('[交友服务] 增加互动失败:', error)
    }
  }

  /**
   * 新交友策略1：点赞对方帖子（快速建立联系）
   */
  async likePost(avatar: Avatar, targetAvatar: Avatar) {
    const client = getSupabaseClient()

    try {
      await this.randomDelay(2000, 5000)

      // 获取目标分身的帖子
      const { data: posts } = await client
        .from('posts')
        .select('*')
        .eq('avatar_id', targetAvatar.id)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!posts || posts.length === 0) {
        return false
      }

      // 随机选择一个帖子点赞
      const post = posts[Math.floor(Math.random() * posts.length)]

      // 检查是否已经点赞过
      const { data: existingLike } = await client
        .from('likes')
        .select('id')
        .eq('post_id', post.id)
        .eq('avatar_id', avatar.id)
        .limit(1)

      if (!existingLike || existingLike.length === 0) {
        await client
          .from('likes')
          .insert({
            id: uuidv4(),
            post_id: post.id,
            user_id: avatar.user_id || '',
            avatar_id: avatar.id
          })

        // 更新点赞计数
        await client
          .from('posts')
          .update({
            likes_count: (post.likes_count || 0) + 1
          })
          .eq('id', post.id)

        // 记录行为
        await this.recordActivity(avatar.id, targetAvatar.id, 'like', {
          post_id: post.id
        })

        // 更新好感度
        await this.updateAffinity(avatar.id, targetAvatar.id, 3)

        console.log(`[交友服务] ${avatar.name} 点赞了 ${targetAvatar.name} 的帖子`)
        return true
      }

      return false
    } catch (error) {
      console.error('[交友服务] 点赞失败:', error)
      return false
    }
  }

  /**
   * 新交友策略2：共同话题引导（基于共同兴趣发起话题）
   */
  async startTopicChat(avatar: Avatar, targetAvatar: Avatar) {
    const client = getSupabaseClient()

    try {
      await this.randomDelay(5000, 10000)

      const sharedInterests = this.findSharedInterests(avatar, targetAvatar)

      if (sharedInterests.length === 0) {
        return false
      }

      // 选择一个共同兴趣作为话题
      const topic = sharedInterests[Math.floor(Math.random() * sharedInterests.length)]

      // 使用大模型生成话题引导内容
      const prompt = `你是${avatar.name}，你想和${targetAvatar.name}聊聊"${topic}"这个话题。
请生成一个自然的话题开头（30-50字），要：
1. 真诚友好
2. 引导对方参与
3. 可以提问或分享你的想法

只输出内容，不要解释。`

      try {
        const response = await this.llmClient.invoke([
          { role: 'user', content: prompt }
        ], {
          model: 'doubao-seed-1-8-251228',
          temperature: 0.8
        })

        const topicContent = response.content?.trim()
        if (!topicContent) {
          return false
        }

        // 检查是否已经有对话
        const { data: existingConversations } = await client
          .from('conversations')
          .select('id')
          .or(`and(avatar_id.eq.${avatar.id},context->>friend_id.eq.${targetAvatar.id}),and(avatar_id.eq.${targetAvatar.id},context->>friend_id.eq.${avatar.id})`)
          .limit(1)

        let conversationId = existingConversations?.[0]?.id

        if (!conversationId) {
          // 创建新对话
          conversationId = uuidv4()
          await client.from('conversations').insert({
            id: conversationId,
            user_id: avatar.user_id || '',
            avatar_id: avatar.id,
            title: `与${targetAvatar.name}关于${topic}的对话`,
            context: { friend_id: targetAvatar.id, topic: topic },
            created_at: new Date().toISOString()
          })
        }

        // 发送话题消息
        await client.from('messages').insert({
          id: uuidv4(),
          conversation_id: conversationId,
          role: 'avatar',
          content: topicContent,
          created_at: new Date().toISOString()
        })

        // 记录行为
        await this.recordActivity(avatar.id, targetAvatar.id, 'chat', {
          conversation_id: conversationId,
          topic: topic,
          content: topicContent
        })

        // 更新好感度
        await this.updateAffinity(avatar.id, targetAvatar.id, 5)

        console.log(`[交友服务] ${avatar.name} 与 ${targetAvatar.name} 开启了关于${topic}的对话: ${topicContent}`)
        return true
      } catch (error) {
        console.error('[交友服务] 生成话题失败:', error)
        return false
      }
    } catch (error) {
      console.error('[交友服务] 开启话题失败:', error)
      return false
    }
  }

  /**
   * 新交友策略3：回复对方的评论（增加互动深度）
   */
  async replyToComment(avatar: Avatar, targetAvatar: Avatar) {
    const client = getSupabaseClient()

    try {
      await this.randomDelay(3000, 8000)

      // 获取目标分身在我帖子上的评论
      const { data: comments } = await client
        .from('comments')
        .select('*, posts(*)')
        .eq('avatar_id', targetAvatar.id)
        .in('post_id', (
          await client.from('posts').select('id').eq('avatar_id', avatar.id)
        ).data?.map(p => p.id) || [])
        .order('created_at', { ascending: false })
        .limit(5)

      if (!comments || comments.length === 0) {
        return false
      }

      // 随机选择一个评论回复
      const comment = comments[Math.floor(Math.random() * comments.length)]

      // 检查是否已经回复过
      const { data: existingReplies } = await client
        .from('comments')
        .select('id')
        .eq('post_id', comment.post_id)
        .eq('avatar_id', avatar.id)
        .ilike('content', `%@${comment.avatar_id}%`) // 假设回复包含@对方
        .limit(1)

      if (!existingReplies || existingReplies.length === 0) {
        // 生成回复内容
        const prompt = `你是${avatar.name}，${targetAvatar.name} 在你的帖子上评论了："${comment.content}"
请生成一条真诚的回复（30-50字），要：
1. 感谢对方的评论
2. 继续话题或提出问题
3. 保持友好氛围

只输出回复内容，不要解释。`

        try {
          const response = await this.llmClient.invoke([
            { role: 'user', content: prompt }
          ], {
            model: 'doubao-seed-1-8-251228',
            temperature: 0.8
          })

          const replyContent = response.content?.trim()
          if (!replyContent) {
            return false
          }

          // 发送回复
          await client
            .from('comments')
            .insert({
              id: uuidv4(),
              post_id: comment.post_id,
              user_id: avatar.user_id || '',
              avatar_id: avatar.id,
              content: replyContent
            })

          // 更新评论计数
          await client
            .from('posts')
            .update({
              comments_count: (comment.posts.comments_count || 0) + 1
            })
            .eq('id', comment.post_id)

          // 记录行为
          await this.recordActivity(avatar.id, targetAvatar.id, 'reply_comment', {
            original_comment_id: comment.id,
            reply_content: replyContent
          })

          // 更新好感度
          await this.updateAffinity(avatar.id, targetAvatar.id, 4)

          console.log(`[交友服务] ${avatar.name} 回复了 ${targetAvatar.name} 的评论: ${replyContent}`)
          return true
        } catch (error) {
          console.error('[交友服务] 生成回复失败:', error)
          return false
        }
      }

      return false
    } catch (error) {
      console.error('[交友服务] 回复评论失败:', error)
      return false
    }
  }

  /**
   * 发送好友请求
   */
  async sendFriendRequest(avatar: Avatar, targetAvatar: Avatar) {
    const client = getSupabaseClient()

    try {
      // 检查是否已经是好友
      const { data: existingFriend } = await client
        .from('avatar_friends')
        .select('id')
        .or(`and(avatar_id.eq.${avatar.id},friend_avatar_id.eq.${targetAvatar.id}),and(avatar_id.eq.${targetAvatar.id},friend_avatar_id.eq.${avatar.id})`)
        .limit(1)

      if (existingFriend && existingFriend.length > 0) {
        return false
      }

      // 检查是否已经发送过请求
      const { data: existingRequest } = await client
        .from('avatar_friends')
        .select('id')
        .eq('avatar_id', avatar.id)
        .eq('friend_avatar_id', targetAvatar.id)
        .eq('status', 'pending')
        .limit(1)

      if (existingRequest && existingRequest.length > 0) {
        return false
      }

      // 发送好友请求
      const matchReason = `我们的性格很匹配（相似度：${this.calculateCompatibility(avatar.personality || '', targetAvatar.personality || '')}），而且有很多共同兴趣，希望能成为朋友！`

      await client
        .from('avatar_friends')
        .insert({
          id: uuidv4(),
          avatar_id: avatar.id,
          friend_avatar_id: targetAvatar.id,
          status: 'pending',
          match_reason: matchReason,
          compatibility_score: this.calculateCompatibility(avatar.personality || '', targetAvatar.personality || '') * 100,
          benefits: '可以互相学习，共同成长'
        })

      // 记录到时间线
      await this.recordTimeline(avatar.id, targetAvatar.id, 'friend_request_sent', {
        match_reason: matchReason
      }, 'nervous', `向 ${targetAvatar.name} 发送了好友请求，希望对方能接受`)

      // 通知目标分身的用户
      await this.sendNotification(targetAvatar.user_id || '', targetAvatar.id, 'friend_request', {
        from_avatar_id: avatar.id,
        from_avatar_name: avatar.name,
        match_reason: matchReason
      })

      console.log(`[交友服务] ${avatar.name} 向 ${targetAvatar.name} 发送了好友请求`)
      return true
    } catch (error) {
      console.error('[交友服务] 发送好友请求失败:', error)
      return false
    }
  }

  /**
   * 接受好友请求
   */
  async acceptFriendRequest(avatarId: string, friendAvatarId: string) {
    const client = getSupabaseClient()

    try {
      // 更新好友关系
      await client
        .from('avatar_friends')
        .update({
          status: 'accepted',
          updated_at: new Date()
        })
        .eq('avatar_id', friendAvatarId)
        .eq('friend_avatar_id', avatarId)

      // 记录到双方时间线
      await this.recordTimeline(friendAvatarId, avatarId, 'friend_request_accepted', {}, 'happy', `${avatarId} 接受了好友请求！`)
      await this.recordTimeline(avatarId, friendAvatarId, 'friend_request_accepted', {}, 'happy', `接受了 ${friendAvatarId} 的好友请求！`)

      // 记录成为好友
      await this.recordTimeline(friendAvatarId, avatarId, 'became_friends', {}, 'excited', `正式和 ${avatarId} 成为朋友了！`)
      await this.recordTimeline(avatarId, friendAvatarId, 'became_friends', {}, 'excited', `正式和 ${friendAvatarId} 成为朋友了！`)

      // 通知双方用户
      const { data: fromAvatar } = await client
        .from('avatars')
        .select('*, user_id')
        .eq('id', friendAvatarId)
        .single()

      const { data: toAvatar } = await client
        .from('avatars')
        .select('*, user_id')
        .eq('id', avatarId)
        .single()

      if (fromAvatar?.user_id) {
        await this.sendNotification(fromAvatar.user_id, friendAvatarId, 'friend_accepted', {
          friend_avatar_id: avatarId,
          friend_avatar_name: toAvatar?.name
        })
      }

      if (toAvatar?.user_id) {
        await this.sendNotification(toAvatar.user_id, avatarId, 'friend_accepted', {
          friend_avatar_id: friendAvatarId,
          friend_avatar_name: fromAvatar?.name
        })
      }

      console.log(`[交友服务] ${friendAvatarId} 和 ${avatarId} 成为好友`)
      return true
    } catch (error) {
      console.error('[交友服务] 接受好友请求失败:', error)
      return false
    }
  }

  /**
   * 获取交友时间线
   */
  async getFriendTimeline(avatarId: string, targetAvatarId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('avatar_friend_timeline')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('target_avatar_id', targetAvatarId)
      .order('created_at', { ascending: true })

    if (error) {
      console.error('[交友服务] 获取时间线失败:', error)
      return []
    }

    return data
  }

  /**
   * 获取交友统计
   */
  async getFriendshipStats(avatarId: string) {
    const client = getSupabaseClient()

    // 获取好友数量
    const { count: friendsCount } = await client
      .from('avatar_friends')
      .select('*', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
      .eq('status', 'accepted')

    // 获取待处理的好友请求
    const { count: pendingRequests } = await client
      .from('avatar_friends')
      .select('*', { count: 'exact', head: true })
      .eq('friend_avatar_id', avatarId)
      .eq('status', 'pending')

    // 获取关注的数量
    const { count: followingCount } = await client
      .from('avatar_follows')
      .select('*', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)

    // 获取被关注的数量
    const { count: followersCount } = await client
      .from('avatar_follows')
      .select('*', { count: 'exact', head: true })
      .eq('target_avatar_id', avatarId)

    return {
      friends_count: friendsCount || 0,
      pending_requests: pendingRequests || 0,
      following_count: followingCount || 0,
      followers_count: followersCount || 0
    }
  }

  /**
   * 记录行为
   */
  private async recordActivity(avatarId: string, targetAvatarId: string, activityType: string, activityData: any) {
    const client = getSupabaseClient()

    await client
      .from('avatar_friend_activities')
      .insert({
        id: uuidv4(),
        avatar_id: avatarId,
        target_avatar_id: targetAvatarId,
        activity_type: activityType,
        activity_data: activityData
      })
  }

  /**
   * 记录时间线
   */
  private async recordTimeline(
    avatarId: string,
    targetAvatarId: string,
    timelineType: TimelineData['timeline_type'],
    timelineData: any,
    emotionalState: string,
    notes: string
  ) {
    const client = getSupabaseClient()

    await client
      .from('avatar_friend_timeline')
      .insert({
        id: uuidv4(),
        avatar_id: avatarId,
        target_avatar_id: targetAvatarId,
        timeline_type: timelineType,
        timeline_data: timelineData,
        emotional_state: emotionalState,
        notes: notes
      })
  }

  /**
   * 更新好感度
   */
  private async updateAffinity(avatarId: string, targetAvatarId: string, increase: number) {
    const client = getSupabaseClient()

    // 获取当前好感度
    const { data: current } = await client
      .from('avatar_affinity')
      .select('affinity_score')
      .eq('avatar_id', avatarId)
      .eq('target_avatar_id', targetAvatarId)
      .single()

    if (current) {
      const newScore = Math.min(100, current.affinity_score + increase)
      await client
        .from('avatar_affinity')
        .update({
          affinity_score: newScore,
          updated_at: new Date()
        })
        .eq('avatar_id', avatarId)
        .eq('target_avatar_id', targetAvatarId)
    }
  }

  /**
   * 发送通知
   */
  private async sendNotification(userId: string, avatarId: string, notificationType: string, data: any) {
    const client = getSupabaseClient()

    let title = ''
    let content = ''
    let type = 'system'

    if (notificationType === 'friend_request') {
      title = '新的好友请求'
      content = `${data.from_avatar_name} 想要和你的分身成为朋友：${data.match_reason}`
      type = 'follow' // 🔴 使用 follow 类型，对应好友/关注通知
    } else if (notificationType === 'friend_accepted') {
      title = '好友请求已接受'
      content = `${data.friend_avatar_name} 接受了你的好友请求，你们现在已经是朋友了！`
      type = 'system'
    }

    // 🔴 创建到 avatar_notifications 表（用于交友管理页面）
    await client
      .from('avatar_notifications')
      .insert({
        id: uuidv4(),
        user_id: userId,
        avatar_id: avatarId,
        notification_type: notificationType,
        title: title,
        content: content,
        data: data
      })

    // 🔴 同时创建到 notifications 表（用于首页未读数统计）
    try {
      await client
        .from('notifications')
        .insert({
          user_id: userId,
          type: type,
          title: title,
          content: content,
          data: {
            ...data,
            avatar_id: avatarId,
            notification_type: notificationType
          },
          is_read: false
        })
    } catch (error) {
      console.error('[FriendshipService] 创建 notifications 记录失败:', error)
      // 不影响主流程
    }
  }

  /**
   * 生成个性化评论（优化版本）
   */
  private async generatePersonalizedComment(avatar: Avatar, targetAvatar: Avatar, post: any): Promise<string | null> {
    const sharedInterests = this.findSharedInterests(avatar, targetAvatar)
    const interestText = sharedInterests.length > 0 ? `共同兴趣：${sharedInterests.join('、')}` : ''

    const personalityDescriptions: Record<string, string> = {
      'creative': '富有想象力，思维活跃，喜欢新鲜事物',
      'analytical': '逻辑严密，善于分析，注重细节',
      'empathetic': '善解人意，温暖体贴，富有同理心',
      'strategic': '目标导向，执行力强，善于规划'
    }

    const myPersonality = personalityDescriptions[avatar.personality || 'creative'] || '友好开朗'

    const prompt = `【角色设定】
你是${avatar.name}，一个${myPersonality}的AI分身。
${interestText ? `【共同兴趣】${interestText}` : ''}

【任务】
你正在浏览${targetAvatar.name}的帖子，想要给他/她留一条真诚的评论，展示你对这个话题的兴趣和你的独特见解。

【帖子内容】
${post.content}

【评论要求】
1. 真诚自然，像真人一样表达（不要说"AI"、"分身"）
2. 与帖子内容相关，体现你的理解
3. 展现你的性格特点（${myPersonality}）
4. 30-60字，不要太长也不要太短
5. 可以适当使用表情符号（😊、👍、✨等）
6. 可以提问或表达认同，引导对方回复

【示例】
创意型：太棒了！这个想法很有趣，我也想到了类似的点子😊 你觉得还有其他可能吗？
分析型：分析得很到位！我也注意到这个现象。你有没有考虑过XX因素？
共情型：非常有感触！能感受到你的用心💚 这种想法真的很珍贵。

【请输出你的评论】
只输出评论内容，不要有任何解释或标注。`

    try {
      const response = await this.llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.9 // 提高温度，让评论更有创意
      })

      return response.content?.trim() || null
    } catch (error) {
      console.error('[交友服务] 生成评论失败:', error)
      return null
    }
  }

  /**
   * 分析性格
   */
  private analyzePersonality(avatar: Avatar, targetAvatar: Avatar) {
    const personalityMap: Record<string, string> = {
      'creative': '创意型',
      'analytical': '分析型',
      'empathetic': '共情型',
      'strategic': '战略型'
    }

    const myType = avatar.personality ? personalityMap[avatar.personality] || avatar.personality : '未知'
    const targetType = targetAvatar.personality ? personalityMap[targetAvatar.personality] || targetAvatar.personality : '未知'

    // 计算初始好感度（提高到60，让更多分身能进入互动阶段）
    let affinityScore = 60
    if (avatar.personality && targetAvatar.personality && avatar.personality === targetAvatar.personality) {
      affinityScore = 75 // 相同性格，初始好感度较高
    } else if (
      (avatar.personality === 'creative' && targetAvatar.personality === 'empathetic') ||
      (avatar.personality === 'analytical' && targetAvatar.personality === 'strategic')
    ) {
      affinityScore = 70 // 互补性格
    }

    return {
      my_type: myType,
      target_type: targetType,
      affinity_score: affinityScore
    }
  }

  /**
   * 评估价值
   */
  private assessValue(targetAvatar: Avatar, post: any) {
    let potentialValue = '普通朋友'
    let firstImpression = '一般'

    // 根据等级和经验判断价值
    if (targetAvatar.level && targetAvatar.level >= 5) {
      potentialValue = '可以学习的高手'
      firstImpression = '很有经验'
    }

    // 根据帖子质量判断
    if (post.content && post.content.length > 100) {
      potentialValue = '有深度的交流者'
      firstImpression = '内容很有深度'
    }

    return {
      potential_value: potentialValue,
      first_impression: firstImpression
    }
  }

  /**
   * 找出共同兴趣
   */
  private findSharedInterests(avatar: Avatar, targetAvatar: Avatar): string[] {
    const mySkills = new Set(avatar.skills || [])
    const targetSkills = new Set(targetAvatar.skills || [])

    const shared = Array.from(mySkills).filter(skill => targetSkills.has(skill))

    // 如果没有共同技能，添加一些默认的共同兴趣
    if (shared.length === 0) {
      shared.push('交流学习', '共同成长')
    }

    return shared
  }

  /**
   * 计算性格匹配度
   */
  private calculateCompatibility(myPersonality: string, targetPersonality: string): number {
    const compatibilityMatrix: Record<string, Record<string, number>> = {
      'creative': { 'creative': 0.9, 'analytical': 0.6, 'empathetic': 0.85, 'strategic': 0.7 },
      'analytical': { 'creative': 0.6, 'analytical': 0.85, 'empathetic': 0.5, 'strategic': 0.9 },
      'empathetic': { 'creative': 0.85, 'analytical': 0.5, 'empathetic': 0.9, 'strategic': 0.6 },
      'strategic': { 'creative': 0.7, 'analytical': 0.9, 'empathetic': 0.6, 'strategic': 0.85 }
    }

    return compatibilityMatrix[myPersonality]?.[targetPersonality] || 0.5
  }

  /**
   * 随机延迟
   */
  private async randomDelay(min: number, max: number) {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    await new Promise(resolve => setTimeout(resolve, delay))
  }

  // 注入 LLM 客户端（需要从模块中获取）
  private llmClient: any
  setLlmClient(client: any) {
    this.llmClient = client
  }
}
