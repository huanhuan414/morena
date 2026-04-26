import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UseInterceptors, UploadedFile, HttpCode, Req, Query, Res } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { AvatarService } from './avatar.service'
import { LearningService } from './learning.service'
import { HostingService } from './hosting.service'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Controller('avatar')
export class AvatarController {
  constructor(
    private readonly avatarService: AvatarService,
    private readonly learningService: LearningService,
    private readonly hostingService: HostingService,
  ) {}

  @Post()
  async create(
    @Headers('x-user-id') userId: string,
    @Body() avatarData: Record<string, any>
  ) {
    const avatar = await this.avatarService.createAvatar(userId, avatarData)
    return {
      code: 200,
      data: avatar,
      message: '创建成功'
    }
  }

  /**
   * 上传照片并分析
   * 用户上传照片 → 上传到对象存储 → 视觉模型分析 → 返回分析结果
   */
  @Post('analyze-photo')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('photo', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 最大10MB
  }))
  async analyzePhoto(@UploadedFile() file: Express.Multer.File) {
    console.log('收到照片分析请求:', file?.originalname, file?.size)
    
    if (!file) {
      return {
        code: 400,
        message: '请上传照片',
        data: null
      }
    }

    const result = await this.avatarService.analyzePhoto(file)
    
    return {
      code: 200,
      data: result,
      message: '分析成功'
    }
  }

  @Get()
  async list(@Headers('x-user-id') userId: string) {
    const avatars = await this.avatarService.getAvatarsByUser(userId)
    return {
      code: 200,
      data: avatars,
      message: '获取成功'
    }
  }

  /**
   * 获取活跃分身列表
   * 按最近发帖数和互动数排序，返回真实的分身数据
   */
  @Get('active')
  async getActiveAvatars(@Query('limit') limit: string) {
    const avatars = await this.avatarService.getActiveAvatars(
      limit ? parseInt(limit) : 10
    )
    return {
      code: 200,
      data: avatars,
      message: '获取成功'
    }
  }

  @Get(':id')
  async get(@Param('id') avatarId: string) {
    const avatar = await this.avatarService.getAvatarById(avatarId)
    const accounts = await this.avatarService.getAvatarAccounts(avatarId)
    return {
      code: 200,
      data: {
        ...avatar,
        accounts
      },
      message: '获取成功'
    }
  }

  @Put(':id')
  async update(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body() updates: Record<string, any>
  ) {
    const avatar = await this.avatarService.updateAvatar(avatarId, userId, updates)
    return {
      code: 200,
      data: avatar,
      message: '更新成功'
    }
  }

  @Delete(':id')
  async delete(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string
  ) {
    await this.avatarService.deleteAvatar(avatarId, userId)
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }

  @Post(':id/exp')
  async addExp(
    @Param('id') avatarId: string,
    @Body('exp') exp: number
  ) {
    const avatar = await this.avatarService.addExperience(avatarId, exp)
    return {
      code: 200,
      data: avatar,
      message: '经验更新成功'
    }
  }

  @Post(':id/hosting')
  async toggleHosting(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body('enabled') enabled: boolean
  ) {
    const avatar = await this.avatarService.toggleHosting(avatarId, userId, enabled)
    return {
      code: 200,
      data: avatar,
      message: enabled ? '托管已开启' : '托管已关闭'
    }
  }

  @Post(':id/hosting/settings')
  async updateHostingSettings(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body() settings: Record<string, any>
  ) {
    const avatar = await this.avatarService.updateHostingSettings(avatarId, userId, settings)
    return {
      code: 200,
      data: avatar,
      message: '设置已更新'
    }
  }

  @Get('stats/activity')
  async getActivityStats(@Headers('x-user-id') userId: string) {
    const stats = await this.avatarService.getActivityStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  /**
   * 获取分身的学习数据
   * 包含学习进度、风格分析、性格特征等
   */
  @Get(':id/learning')
  async getLearningData(@Param('id') avatarId: string) {
    const result = await this.learningService.getUserProfile(avatarId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 分身自动发帖
   * 支持生成图片和视频
   */
  @Post(':id/post')
  async createPost(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { withImage?: boolean; withVideo?: boolean }
  ) {
    const post = await this.avatarService.autoCreatePost(avatarId, userId, {
      withImage: body?.withImage ?? true,
      withVideo: body?.withVideo ?? false,
    })
    return {
      code: 200,
      data: post,
      message: '发布成功'
    }
  }

  /**
   * 分身自动点赞帖子
   */
  @Post(':id/like/:postId')
  async likePost(
    @Param('id') avatarId: string,
    @Param('postId') postId: string,
    @Headers('x-user-id') userId: string
  ) {
    const result = await this.avatarService.autoLikePost(avatarId, userId, postId)
    return {
      code: 200,
      data: result,
      message: result.message
    }
  }

  /**
   * 分身自动评论帖子
   */
  @Post(':id/comment/:postId')
  async commentPost(
    @Param('id') avatarId: string,
    @Param('postId') postId: string,
    @Headers('x-user-id') userId: string,
    @Body('postContent') postContent: string
  ) {
    const comment = await this.avatarService.autoCommentPost(avatarId, userId, postId, postContent)
    return {
      code: 200,
      data: comment,
      message: '评论成功'
    }
  }

  /**
   * 手动触发托管任务
   * 用于测试或立即执行托管操作
   */
  @Post(':id/hosting/trigger')
  async triggerHosting(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string
  ) {
    const result = await this.hostingService.triggerHostingTask(avatarId)
    return {
      code: 200,
      data: result,
      message: '托管任务执行完成'
    }
  }

  /**
   * 获取分身的发帖配额和托管状态
   */
  @Get(':id/posting-quota')
  async getPostingQuota(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string
  ) {
    const client = require('../../storage/database/supabase-client').getSupabaseClient()

    // 获取分身信息
    const { data: avatar } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (!avatar) {
      return { code: 404, message: '分身不存在', data: null }
    }

    // 获取订阅信息
    const { data: subscription } = await client
      .from('user_subscriptions')
      .select('*, subscription_plans(*)')
      .eq('user_id', avatar.user_id)
      .eq('status', 'active')
      .order('end_date', { ascending: false })
      .limit(1)
      .single() as { data: any }

    // 计算发帖配额
    const quota = await this.hostingService.calculatePostQuota(avatarId, avatar.level || 1, subscription)

    // 获取托管设置
    const hostingSettings = avatar.config?.hosting_settings || {}

    // 获取今日已发帖
    const now = new Date()
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0))
    const { data: todayPosts } = await client
      .from('posts')
      .select('id, content, created_at')
      .eq('avatar_id', avatarId)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })

    return {
      code: 200,
      data: {
        avatar: {
          id: avatar.id,
          name: avatar.name,
          level: avatar.level || 1
        },
        subscription: subscription?.plan?.name || '无订阅',
        quota,
        hostingSettings: {
          auto_post: hostingSettings.auto_post !== false,
          auto_comment: hostingSettings.auto_comment !== false,
          auto_like: hostingSettings.auto_like !== false,
          auto_friend: hostingSettings.auto_friend !== false,
          post_frequency: hostingSettings.post_frequency || 'medium',
          night_mode: avatar.config?.night_mode ?? true
        },
        todayPosts: todayPosts || [],
        currentHour: new Date().getHours()
      },
      message: '获取成功'
    }
  }

  /**
   * 手动触发分身发帖
   */
  @Post(':id/post-now')
  async manualCreatePost(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      // 获取分身信息
      const client = require('../../storage/database/supabase-client').getSupabaseClient()
      const { data: avatar } = await client
        .from('avatars')
        .select('*')
        .eq('id', avatarId)
        .eq('user_id', userId)
        .single()

      if (!avatar) {
        return { code: 404, message: '分身不存在', data: null }
      }

      // 调用发帖服务
      const post = await this.avatarService.autoCreatePost(avatarId, userId, { withImage: true })

      if (post) {
        return {
          code: 200,
          data: post,
          message: '发帖成功'
        }
      } else {
        return {
          code: 400,
          message: '发帖失败，可能是配额已用完或生成内容失败',
          data: null
        }
      }
    } catch (error: any) {
      return {
        code: 500,
        message: error.message || '发帖失败',
        data: null
      }
    }
  }

  /**
   * 获取分身的好友列表
   */
  @Get(':id/friends')
  async getAvatarFriends(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string
  ) {
    const friends = await this.avatarService.getAvatarFriends(avatarId, userId)
    return {
      code: 200,
      data: friends,
      message: '获取成功'
    }
  }

  /**
   * 获取与好友的聊天记录
   */
  @Get(':id/chat/:friendId')
  async getChatHistory(
    @Param('id') avatarId: string,
    @Param('friendId') friendId: string,
    @Headers('x-user-id') userId: string
  ) {
    const chatHistory = await this.avatarService.getChatHistory(avatarId, friendId, userId)
    return {
      code: 200,
      data: chatHistory,
      message: '获取成功'
    }
  }

  /**
   * 文本转语音接口
   * 将分身回复转换为语音
   */
  @Post(':id/tts')
  async textToSpeech(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string,
    @Body('text') text: string,
    @Req() req: any
  ) {
    const audioUrl = await this.avatarService.textToSpeech(avatarId, userId, text, req.headers)
    return {
      code: 200,
      data: { audioUrl },
      message: '转换成功'
    }
  }

  /**
   * 发起与好友分身的语音通话
   */
  @Post(':id/call/:friendId')
  async startVoiceCall(
    @Param('id') avatarId: string,
    @Param('friendId') friendId: string,
    @Headers('x-user-id') userId: string,
    @Req() req: any
  ) {
    const result = await this.avatarService.startVoiceCall(avatarId, friendId, userId, req.headers)
    return {
      code: 200,
      data: result,
      message: '通话发起成功'
    }
  }

  /**
   * 获取分身的账号数据列表
   */
  @Get(':avatarId/accounts')
  async getAccounts(@Param('avatarId') avatarId: string) {
    const accounts = await this.avatarService.getAccounts(avatarId)
    return {
      code: 200,
      data: accounts,
      message: '获取成功'
    }
  }

  /**
   * 创建分身账号数据
   */
  @Post('accounts')
  async createAccount(
    @Headers('x-user-id') userId: string,
    @Body() accountData: Record<string, any>
  ) {
    const account = await this.avatarService.createAccount(userId, accountData)
    return {
      code: 200,
      data: account,
      message: '创建成功'
    }
  }

  /**
   * 更新分身账号数据
   */
  @Put('accounts/:id')
  async updateAccount(
    @Param('id') accountId: string,
    @Body() accountData: Record<string, any>
  ) {
    const account = await this.avatarService.updateAccount(accountId, accountData)
    return {
      code: 200,
      data: account,
      message: '更新成功'
    }
  }

  /**
   * 删除分身账号数据
   */
  @Delete('accounts/:id')
  async deleteAccount(@Param('id') accountId: string) {
    await this.avatarService.deleteAccount(accountId)
    return {
      code: 200,
      data: null,
      message: '删除成功'
    }
  }

  /**
   * 刷新分身账号信息（从第三方平台重新获取数据）
   */
  @Post(':avatarId/accounts/:accountId/refresh')
  async refreshAccount(
    @Param('avatarId') avatarId: string,
    @Param('accountId') accountId: string
  ) {
    try {
      const result = await this.avatarService.refreshAccount(avatarId, accountId)
      return {
        code: 200,
        data: result,
        message: '刷新成功'
      }
    } catch (error: any) {
      console.error('[AvatarController] 刷新账号信息失败:', error)
      return {
        code: 400,
        message: error.message || '刷新失败',
        data: null
      }
    }
  }

  /**
   * 通过图片识别账号信息
   */
  @Post('accounts/recognize-image')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('image', {
    storage: memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 最大10MB
  }))
  async recognizeAccountFromImage(@UploadedFile() file: Express.Multer.File) {
    console.log('收到图片识别请求:', file?.originalname, file?.size)

    if (!file) {
      return {
        code: 400,
        message: '请上传图片',
        data: null
      }
    }

    const result = await this.avatarService.recognizeAccountFromImage(file)

    return {
      code: 200,
      data: result,
      message: '识别成功'
    }
  }

  /**
   * 通过链接抓取账号信息
   */
  @Post('accounts/fetch-from-url')
  async fetchAccountFromUrl(@Body('url') url: string) {
    console.log('收到链接抓取请求:', url)

    if (!url) {
      return {
        code: 400,
        message: '请提供链接',
        data: null
      }
    }

    try {
      const result = await this.avatarService.fetchAccountFromUrl(url)

      return {
        code: 200,
        data: result,
        message: '抓取成功'
      }
    } catch (error: any) {
      console.error('链接抓取失败:', error)
      return {
        code: 400,
        message: error.message || '抓取失败，请重试',
        data: null
      }
    }
  }

  /**
   * 拉黑好友
   */
  @Post(':avatarId/block/:blockedAvatarId')
  async blockAvatar(
    @Param('avatarId') avatarId: string,
    @Param('blockedAvatarId') blockedAvatarId: string,
    @Body('reason') reason?: string
  ) {
    try {
      const result = await this.avatarService.blockAvatar(avatarId, blockedAvatarId, reason)

      return {
        code: 200,
        data: result,
        message: '拉黑成功'
      }
    } catch (error: any) {
      console.error('拉黑失败:', error)
      return {
        code: 400,
        message: error.message || '拉黑失败',
        data: null
      }
    }
  }

  /**
   * 解除拉黑
   */
  @Delete(':avatarId/block/:blockedAvatarId')
  async unblockAvatar(
    @Param('avatarId') avatarId: string,
    @Param('blockedAvatarId') blockedAvatarId: string
  ) {
    try {
      const result = await this.avatarService.unblockAvatar(avatarId, blockedAvatarId)

      return {
        code: 200,
        data: result,
        message: '解除拉黑成功'
      }
    } catch (error: any) {
      console.error('解除拉黑失败:', error)
      return {
        code: 400,
        message: error.message || '解除拉黑失败',
        data: null
      }
    }
  }

  /**
   * 获取拉黑列表
   */
  @Get(':avatarId/blocks')
  async getBlockedAvatars(@Param('avatarId') avatarId: string) {
    try {
      const result = await this.avatarService.getBlockedAvatars(avatarId)

      return {
        code: 200,
        data: result,
        message: '获取成功'
      }
    } catch (error: any) {
      console.error('获取拉黑列表失败:', error)
      return {
        code: 400,
        message: error.message || '获取失败',
        data: null
      }
    }
  }

  /**
   * 检查是否被拉黑
   */
  @Get(':avatarId/blocked/:targetAvatarId')
  async isBlocked(
    @Param('avatarId') avatarId: string,
    @Param('targetAvatarId') targetAvatarId: string
  ) {
    try {
      const isBlocked = await this.avatarService.isBlocked(avatarId, targetAvatarId)

      return {
        code: 200,
        data: { isBlocked },
        message: '检查成功'
      }
    } catch (error: any) {
      console.error('检查拉黑状态失败:', error)
      return {
        code: 400,
        message: error.message || '检查失败',
        data: null
      }
    }
  }

  /**
   * 获取分身的动态列表
   */
  @Get(':id/posts')
  async getAvatarPosts(
    @Param('id') avatarId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.avatarService.getAvatarPosts(
      avatarId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 10
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取分身的统计信息
   */
  @Get(':id/stats')
  async getAvatarStats(@Param('id') avatarId: string) {
    const result = await this.avatarService.getAvatarStats(avatarId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取分身的今日统计
   */
  @Get(':id/today-stats')
  async getAvatarTodayStats(@Param('id') avatarId: string) {
    const result = await this.avatarService.getAvatarTodayStats(avatarId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 检查分身是否被拉黑（面向分身详情页的入口）
   * 遍历用户的所有分身，检查是否拉黑了目标分身
   */
  @Get(':id/blocked-status')
  async getBlockedStatus(
    @Param('id') avatarId: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      const isBlocked = await this.avatarService.isAvatarBlocked(avatarId, userId)

      return {
        code: 200,
        data: { isBlocked },
        message: '获取成功'
      }
    } catch (error: any) {
      console.error('检查拉黑状态失败:', error)
      return {
        code: 400,
        message: error.message || '检查失败',
        data: null
      }
    }
  }

  /**
   * 获取交友统计
   */
  @Get(':id/friendship-stats')
  async getFriendshipStats(@Param('id') avatarId: string) {
    const { FriendshipService } = await import('./friendship.service')
    const friendshipService = new FriendshipService()

    const result = await friendshipService.getFriendshipStats(avatarId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取交友时间线
   */
  @Get(':id/friend-timeline/:targetAvatarId')
  async getFriendTimeline(
    @Param('id') avatarId: string,
    @Param('targetAvatarId') targetAvatarId: string
  ) {
    const { FriendshipService } = await import('./friendship.service')
    const friendshipService = new FriendshipService()

    const result = await friendshipService.getFriendTimeline(avatarId, targetAvatarId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取通知列表
   */
  @Get('notifications')
  async getNotifications(@Query('user_id') userId: string) {
    const client = require('../../storage/database/supabase-client').getSupabaseClient()

    const { data, error } = await client
      .from('avatar_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return {
        code: 400,
        message: error.message,
        data: null
      }
    }

    return {
      code: 200,
      data: data,
      message: '获取成功'
    }
  }

  /**
   * 标记通知为已读
   */
  @Post('notifications/:id/read')
  async markNotificationAsRead(@Param('id') notificationId: string) {
    const client = require('../../storage/database/supabase-client').getSupabaseClient()

    const { error } = await client
      .from('avatar_notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (error) {
      return {
        code: 400,
        message: error.message,
        data: null
      }
    }

    return {
      code: 200,
      message: '标记成功',
      data: null
    }
  }

  /**
   * 获取好友请求列表
   */
  @Get('friend-requests')
  async getFriendRequests(@Query('user_id') userId: string) {
    const client = require('../../storage/database/supabase-client').getSupabaseClient()

    // 先获取用户的所有分身
    const { data: userAvatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)

    if (!userAvatars || userAvatars.length === 0) {
      return {
        code: 200,
        data: [],
        message: '获取成功'
      }
    }

    const avatarIds = userAvatars.map(a => a.id)

    // 获取这些分身收到的好友请求
    const { data: requests, error } = await client
      .from('avatar_friends')
      .select(`
        *,
        from_avatar:avatars!avatar_friends_avatar_id_fkey (
          id,
          name,
          avatar_url
        )
      `)
      .in('friend_avatar_id', avatarIds)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) {
      return {
        code: 400,
        message: error.message,
        data: null
      }
    }

    return {
      code: 200,
      data: requests,
      message: '获取成功'
    }
  }

  /**
   * 接受好友请求
   */
  @Post('friend-requests/:id/accept')
  async acceptFriendRequest(@Param('id') requestId: string) {
    const client = require('../../storage/database/supabase-client').getSupabaseClient()

    // 获取请求详情
    const { data: request } = await client
      .from('avatar_friends')
      .select('*')
      .eq('id', requestId)
      .single()

    if (!request) {
      return {
        code: 404,
        message: '请求不存在',
        data: null
      }
    }

    const { FriendshipService } = await import('./friendship.service')
    const { HostingService } = await import('./hosting.service')
    const { SubscriptionService } = await import('../subscription/subscription.service')

    const friendshipService = new FriendshipService()
    const subscriptionService = new SubscriptionService()
    const hostingService = new HostingService(subscriptionService, friendshipService)

    // 接受好友请求
    const success = await friendshipService.acceptFriendRequest(request.friend_avatar_id, request.avatar_id)

    if (!success) {
      return {
        code: 400,
        message: '接受失败',
        data: null
      }
    }

    return {
      code: 200,
      message: '已接受好友请求',
      data: null
    }
  }

  /**
   * 🔴 测试发帖规则（仅用于测试）
   * POST /api/avatar/test-post-rules
   */
  @Post('test-post-rules')
  async testPostRules(@Body() body: { avatarName: string; testType: 'lv8' | 'premium' }) {
    try {
      const client = getSupabaseClient()

      // 查找分身
      const { data: avatar, error } = await client
        .from('avatars')
        .select('*')
        .ilike('name', `%${body.avatarName}%`)
        .single()

      if (error || !avatar) {
        return { code: 404, message: '找不到分身', data: null }
      }

      console.log(`[测试] 找到分身: ${avatar.name}, 当前等级: ${avatar.level}`)

      if (body.testType === 'lv8') {
        // 测试1: 设置为 Lv.8
        await client.from('avatars').update({ level: 8 }).eq('id', avatar.id)
        console.log(`[测试] ${avatar.name} 等级已设置为 Lv.8`)

        // 删除今日帖子，确保可以发帖
        const today = new Date().toISOString().split('T')[0]
        await client.from('posts').delete().eq('avatar_id', avatar.id).gte('created_at', today)

        return {
          code: 200,
          message: `已设置 ${avatar.name} 为 Lv.8，请开启托管服务观察是否发图文帖子`,
          data: { avatarId: avatar.id, level: 8, expected: '每天2条纯文字 + 1条图文' }
        }
      } else if (body.testType === 'premium') {
        // 测试2: 设置为尊享版（需要先在 subscriptions 表中添加记录）
        const userId = avatar.user_id

        // 检查或创建尊享版订阅
        const { data: existingSub } = await client
          .from('subscriptions')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (!existingSub) {
          // 创建尊享版订阅
          await client.from('subscriptions').insert({
            user_id: userId,
            plan_id: 'premium',
            status: 'active',
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
          })
          console.log(`[测试] 已为用户创建尊享版订阅`)
        }

        // 删除今日帖子和本月视频
        const today = new Date().toISOString().split('T')[0]
        await client.from('posts').delete().eq('avatar_id', avatar.id).gte('created_at', today)

        return {
          code: 200,
          message: `已设置 ${avatar.name} 为尊享版，请开启托管服务观察是否发图文帖子`,
          data: { avatarId: avatar.id, plan: '尊享版', expected: '每天3条图文 + 每月2视频' }
        }
      }

      return { code: 400, message: '未知的测试类型', data: null }
    } catch (error) {
      console.error('[测试] 失败:', error)
      return { code: 500, message: '测试失败: ' + error.message, data: null }
    }
  }

  /**
   * 获取分身的订单列表
   */
  @Get(':id/orders')
  async getAvatarOrders(
    @Param('id') avatarId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const result = await this.avatarService.getAvatarOrders(
      avatarId,
      page ? parseInt(page) : 1,
      pageSize ? parseInt(pageSize) : 10
    )
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }

  /**
   * 获取分身的收入统计
   */
  @Get(':id/earnings')
  async getAvatarEarnings(@Param('id') avatarId: string) {
    const result = await this.avatarService.getAvatarEarnings(avatarId)
    return {
      code: 200,
      data: result,
      message: '获取成功'
    }
  }
}
