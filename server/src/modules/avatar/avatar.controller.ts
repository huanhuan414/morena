// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Param, Headers, Body, Query, Inject, BadRequestException, InternalServerErrorException, HttpException } from '@nestjs/common'
import { AvatarService } from './avatar.service'
import { assertResourceOwner, requireAuthenticatedUserId, rethrowAuthError } from '../../common/auth-user.util'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Controller('avatar')
export class AvatarController {
  constructor(@Inject('AVATAR_SERVICE') private readonly avatarService: AvatarService) {}

  private getAuthenticatedUserId(headers: Record<string, string | string[] | undefined>) {
    return requireAuthenticatedUserId(headers)
  }

  private async assertAvatarOwner(avatarId: string, userId: string, message: string = '无权访问该分身资源') {
    const avatar = await this.avatarService.getAvatarById(avatarId)
    const avatarData = avatar?.data
    if (!avatarData) {
      throw new Error('分身不存在')
    }
    const ownerUserId = avatarData?.userId || avatarData?.user_id
    assertResourceOwner(userId, ownerUserId, message)
  }

  private async assertAccountOwner(accountId: string, userId: string, message: string = '无权访问该账号资源') {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT aa.id, aa.avatar_id, a.user_id
       FROM avatar_accounts aa
       INNER JOIN avatars a ON aa.avatar_id = a.id
       WHERE aa.id = ?
       LIMIT 1`,
      [accountId]
    )
    const account = rows?.[0]
    if (!account) {
      throw new Error('账号不存在')
    }
    assertResourceOwner(userId, account.userId || account.user_id, message)
    return account
  }

  private async assertSkillOwner(skillId: string, userId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT s.id, a.user_id
       FROM avatar_skills s
       INNER JOIN avatars a ON s.avatar_id = a.id
       WHERE s.id = ?
       LIMIT 1`,
      [skillId]
    )
    const skill = rows?.[0]
    if (!skill) {
      throw new Error('技能不存在')
    }
    assertResourceOwner(userId, skill.userId || skill.user_id, '无权操作该分身技能')
  }

  private async assertMemoryOwner(memoryId: string, userId: string) {
    const db = getMySQLClient()
    const rows = await db.query(
      `SELECT m.id, a.user_id
       FROM avatar_memories m
       INNER JOIN avatars a ON m.avatar_id = a.id
       WHERE m.id = ?
       LIMIT 1`,
      [memoryId]
    )
    const memory = rows?.[0]
    if (!memory) {
      throw new Error('记忆不存在')
    }
    assertResourceOwner(userId, memory.userId || memory.user_id, '无权操作该分身记忆')
  }

  @Post()
  async createAvatar(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: {
      name: string;
      photo?: string;
      tags?: string[];
      voice_type?: string;
      voice_url?: string;
      preset_voice_id?: string;
      abilities?: Record<string, boolean>;
      avatar_url?: string;
      description?: string;
      gender?: string;
      age?: number;
    }
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const avatar = await this.avatarService.createAvatar(userId, {
        name: body.name,
        photo: body.photo || body.avatar_url || '',
        tags: body.tags || [],
        voice_type: body.voice_type || 'preset',
        voice_url: body.voice_url,
        preset_voice_id: body.preset_voice_id,
        abilities: body.abilities || { chat: true, reading: true, analysis: false },
        description: body.description || '',
        gender: body.gender,
        age: body.age
      })
      return { code: 200, msg: 'success', data: avatar }
    } catch (err) {
      rethrowAuthError(err)
      console.error('创建分身失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  @Get()
  async getAllAvatars(@Headers() headers: Record<string, string | string[] | undefined>) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const avatars = await this.avatarService.getUserAvatars(userId)
      return { code: 200, msg: 'success', data: avatars.data || [] }
    } catch (err) {
      rethrowAuthError(err)
      console.error('获取分身列表失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: [] })
    }
  }

  @Get('list')
  async getAvatarList(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('gender') gender?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('search') search?: string
  ) {
    try {
      this.getAuthenticatedUserId(headers)
      const pageNum = parseInt(page) || 1
      const size = parseInt(pageSize) || 10
      const result = await this.avatarService.getAvatarList({ page: pageNum, pageSize: size, gender, ageGroup, search })
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      rethrowAuthError(err)
      console.error('获取分身列表失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  /**
   * 匿名边界：公开只读搜索接口，允许未登录用户检索可浏览分身，不承载任何写操作。
   */
  @Get('search')
  async searchAvatars(@Query('keyword') keyword: string) {
    try {
      const result = await this.avatarService.searchAvatars(keyword)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      console.error('搜索分身失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: [] })
    }
  }

  /**
   * 匿名边界：公开只读详情接口，允许未登录用户查看分身展示信息，不返回需鉴权的私有配置。
   */
  @Get(':id')
  async getAvatarDetail(@Param('id') id: string) {
    try {
      const avatar = await this.avatarService.getAvatarById(id)
      return { code: 200, msg: 'success', data: avatar?.data ?? null }
    } catch (err) {
      console.error('获取分身详情失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  /**
   * 匿名边界：公开只读轮询接口，用于语音复刻状态查询；仅返回任务状态，不允许匿名修改任务。
   */
  @Get(':id/voice-status')
  async getVoiceCloneStatus(@Param('id') id: string) {
    try {
      const status = await this.avatarService.getVoiceCloneStatus(id)
      return { code: 200, msg: 'success', data: status }
    } catch (err) {
      console.error('获取声音复刻状态失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  @Put(':id')
  async updateAvatar(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: {
      name?: string;
      photo?: string;
      tags?: string[];
      abilities?: Record<string, boolean>;
      avatar_url?: string;
      description?: string;
      config?: Record<string, any> | string;
      personality?: Record<string, any> | string;
      latitude?: number;
      longitude?: number;
      location_text?: string;
      locationText?: string;
    }
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      await this.avatarService.updateAvatar(id, {
        name: body.name,
        photo: body.photo || body.avatar_url,
        tags: body.tags,
        abilities: body.abilities,
        description: body.description,
        config: body.config,
        personality: body.personality,
        latitude: body.latitude,
        longitude: body.longitude,
        location_text: body.location_text || body.locationText
      })
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      console.error('更新分身失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  @Delete(':id')
  async deleteAvatar(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const result = await this.avatarService.deleteAvatar(id, userId)
      if (!result.success) {
        throw new BadRequestException({ msg: result.error || '删除失败', data: null })
      }
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      console.error('删除分身失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  // 技能管理
  @Get(':id/skills')
  async getSkills(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      const skills = await this.avatarService.getSkills(id)
      return { code: 200, msg: 'success', data: skills }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: [] })
    }
  }

  @Post(':id/skills')
  async addSkill(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { skill_name: string; skill_description?: string; skill_config?: any }
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      const skill = await this.avatarService.addSkill(id, body)
      return { code: 200, msg: 'success', data: skill }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  @Delete(':id/skills/:skillId')
  async deleteSkill(
    @Param('skillId') skillId: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertSkillOwner(skillId, userId)
      await this.avatarService.deleteSkill(parseInt(skillId))
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  // 记忆管理
  @Get(':id/memories')
  async getMemories(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      const memories = await this.avatarService.getMemories(id)
      return { code: 200, msg: 'success', data: memories }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: [] })
    }
  }

  @Post(':id/memories')
  async addMemory(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { memory_type: string; memory_content: string; importance?: number }
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      const memory = await this.avatarService.addMemory(id, body)
      return { code: 200, msg: 'success', data: memory }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  @Delete(':id/memories/:memoryId')
  async deleteMemory(
    @Param('memoryId') memoryId: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertMemoryOwner(memoryId, userId)
      await this.avatarService.deleteMemory(parseInt(memoryId))
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  // 统计
  @Get(':id/stats')
  async getStats(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      const stats = await this.avatarService.getStats(id)
      return { code: 200, msg: 'success', data: stats }
    } catch (err) {
      rethrowAuthError(err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: '服务器错误', data: null })
    }
  }

  // 托管状态管理
  @Put(':id/trust')
  async updateTrust(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { trust_enabled: boolean }
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      await this.avatarService.updateTrust(id, body.trust_enabled)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      console.error('更新托管状态失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  @Put('trust/all')
  async enableAllTrust(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: { trust_enabled: boolean }
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.avatarService.enableAllTrust(userId, body.trust_enabled)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      console.error('批量更新托管状态失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  @Post(':id/hosting/settings')
  async updateHostingSettings(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, any>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(id, userId)
      const result = await this.avatarService.updateHostingSettings(id, body || {})
      return { code: 200, msg: 'success', data: result?.data || null }
    } catch (err) {
      rethrowAuthError(err)
      console.error('更新托管设置失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  // ==================== 账号管理 ====================

  @Get(':avatarId/accounts')
  async getAccounts(
    @Param('avatarId') avatarId: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAvatarOwner(avatarId, userId)
      const accounts = await this.avatarService.getAccounts(avatarId)
      return { code: 200, msg: 'success', data: accounts }
    } catch (err) {
      rethrowAuthError(err)
      console.error('获取账号列表失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: [] })
    }
  }

  @Post('accounts')
  async createAccount(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, any>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const avatarId = body?.avatarId || body?.avatar_id
      if (!avatarId) {
        throw new Error('缺少 avatarId')
      }
      await this.assertAvatarOwner(avatarId, userId)
      const account = await this.avatarService.createAccount(body)
      return { code: 200, msg: 'success', data: account }
    } catch (err) {
      rethrowAuthError(err)
      console.error('创建账号失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  @Put('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, any>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      const existingAccount = await this.assertAccountOwner(id, userId)
      const avatarId = body?.avatarId || body?.avatar_id || existingAccount?.avatarId || existingAccount?.avatar_id
      if (avatarId) await this.assertAvatarOwner(avatarId, userId)
      const account = await this.avatarService.updateAccount(id, body)
      return { code: 200, msg: 'success', data: account }
    } catch (err) {
      rethrowAuthError(err)
      console.error('更新账号失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  @Delete('accounts/:id')
  async deleteAccount(
    @Param('id') id: string,
    @Headers() headers: Record<string, string | string[] | undefined>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      await this.assertAccountOwner(id, userId)
      await this.avatarService.deleteAccount(id)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      rethrowAuthError(err)
      console.error('删除账号失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '服务器错误', data: null })
    }
  }

  /**
   * 发布内容到微信公众号草稿箱
   * Body: { accountId, title, content, imageUrls, digest? }
   */
  @Post('publish/wechat-draft')
  async publishWechatDraft(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: Record<string, any>
  ) {
    try {
      const userId = this.getAuthenticatedUserId(headers)
      if (body?.accountId) {
        await this.assertAccountOwner(body.accountId, userId)
      }
      const result = await this.avatarService.publishWechatDraft(body)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      rethrowAuthError(err)
      console.error('发布公众号草稿失败:', err)
      if (err instanceof HttpException) throw err
      throw new InternalServerErrorException({ msg: err.message || '发布失败', data: null })
    }
  }
}
