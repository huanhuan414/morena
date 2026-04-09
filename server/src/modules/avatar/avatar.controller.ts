import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UseInterceptors, UploadedFile, HttpCode, Req, Query } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { AvatarService } from './avatar.service'
import { LearningService } from './learning.service'
import { HostingService } from './hosting.service'

@Controller('avatar')
export class AvatarController {
  constructor(
    private readonly avatarService: AvatarService,
    private readonly learningService: LearningService,
    private readonly hostingService: HostingService
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

  @Get(':id')
  async get(@Param('id') avatarId: string) {
    const avatar = await this.avatarService.getAvatarById(avatarId)
    return {
      code: 200,
      data: avatar,
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
   * 获取与好友的聊天记录
   */
  @Get(':id/chat/:friendId')
  async getChatWithFriend(
    @Param('id') avatarId: string,
    @Param('friendId') friendId: string,
    @Headers('x-user-id') userId: string
  ) {
    const messages = await this.avatarService.getChatWithFriend(avatarId, friendId, userId)
    return {
      code: 200,
      data: messages,
      message: '获取成功'
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
}
