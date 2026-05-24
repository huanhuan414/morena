// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Param, Headers, Body, Query, Inject } from '@nestjs/common'
import { AvatarService } from './avatar.service'

@Controller('avatar')
export class AvatarController {
  constructor(@Inject('AVATAR_SERVICE') private readonly avatarService: AvatarService) {}

  @Post()
  async createAvatar(
    @Headers('x-user-id') userId: string,
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
      console.error('创建分身失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Get()
  async getAllAvatars(@Headers('x-user-id') userId?: string) {
    try {
      const avatars = await this.avatarService.getUserAvatars(userId)
      return { code: 200, msg: 'success', data: avatars.data || [] }
    } catch (err) {
      console.error('获取分身列表失败:', err)
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Get('list')
  async getAvatarList(
    @Headers('x-user-id') userId: string,
    @Query('page') page: string = '1',
    @Query('pageSize') pageSize: string = '10',
    @Query('gender') gender?: string,
    @Query('ageGroup') ageGroup?: string,
    @Query('search') search?: string
  ) {
    try {
      const pageNum = parseInt(page) || 1
      const size = parseInt(pageSize) || 10
      const result = await this.avatarService.getAvatarList({ page: pageNum, pageSize: size, gender, ageGroup, search })
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      console.error('获取分身列表失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Get('search')
  async searchAvatars(@Query('keyword') keyword: string) {
    try {
      const result = await this.avatarService.searchAvatars(keyword)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      console.error('搜索分身失败:', err)
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Get(':id')
  async getAvatarDetail(@Param('id') id: string) {
    try {
      const avatar = await this.avatarService.getAvatarById(id)
      return { code: 200, msg: 'success', data: avatar?.data ?? null }
    } catch (err) {
      console.error('获取分身详情失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Get(':id/voice-status')
  async getVoiceCloneStatus(@Param('id') id: string) {
    try {
      const status = await this.avatarService.getVoiceCloneStatus(id)
      return { code: 200, msg: 'success', data: status }
    } catch (err) {
      console.error('获取声音复刻状态失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Put(':id')
  async updateAvatar(
    @Param('id') id: string,
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
      console.error('更新分身失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id')
  async deleteAvatar(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      const result = await this.avatarService.deleteAvatar(id, userId)
      if (!result.success) {
        return { code: 400, msg: result.error || '删除失败', data: null }
      }
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      console.error('删除分身失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  // 技能管理
  @Get(':id/skills')
  async getSkills(@Param('id') id: string) {
    try {
      const skills = await this.avatarService.getSkills(id)
      return { code: 200, msg: 'success', data: skills }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Post(':id/skills')
  async addSkill(
    @Param('id') id: string,
    @Body() body: { skill_name: string; skill_description?: string; skill_config?: any }
  ) {
    try {
      const skill = await this.avatarService.addSkill(id, body)
      return { code: 200, msg: 'success', data: skill }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id/skills/:skillId')
  async deleteSkill(@Param('skillId') skillId: string) {
    try {
      await this.avatarService.deleteSkill(parseInt(skillId))
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  // 记忆管理
  @Get(':id/memories')
  async getMemories(@Param('id') id: string) {
    try {
      const memories = await this.avatarService.getMemories(id)
      return { code: 200, msg: 'success', data: memories }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Post(':id/memories')
  async addMemory(
    @Param('id') id: string,
    @Body() body: { memory_type: string; memory_content: string; importance?: number }
  ) {
    try {
      const memory = await this.avatarService.addMemory(id, body)
      return { code: 200, msg: 'success', data: memory }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id/memories/:memoryId')
  async deleteMemory(@Param('memoryId') memoryId: string) {
    try {
      await this.avatarService.deleteMemory(parseInt(memoryId))
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  // 统计
  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    try {
      const stats = await this.avatarService.getStats(id)
      return { code: 200, msg: 'success', data: stats }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  // 托管状态管理
  @Put(':id/trust')
  async updateTrust(
    @Param('id') id: string,
    @Body() body: { trust_enabled: boolean }
  ) {
    try {
      await this.avatarService.updateTrust(id, body.trust_enabled)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      console.error('更新托管状态失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Put('trust/all')
  async enableAllTrust(
    @Headers('x-user-id') userId: string,
    @Body() body: { trust_enabled: boolean }
  ) {
    try {
      await this.avatarService.enableAllTrust(userId, body.trust_enabled)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      console.error('批量更新托管状态失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Post(':id/hosting/settings')
  async updateHostingSettings(
    @Param('id') id: string,
    @Body() body: Record<string, any>
  ) {
    try {
      const result = await this.avatarService.updateHostingSettings(id, body || {})
      return { code: 200, msg: 'success', data: result?.data || null }
    } catch (err) {
      console.error('更新托管设置失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  // ==================== 账号管理 ====================

  @Get('accounts/by-user')
  async getAccountsByUser(@Headers('x-user-id') userId: string) {
    try {
      const accounts = await this.avatarService.getAccountsByUserId(userId)
      return { code: 200, msg: 'success', data: accounts }
    } catch (err) {
      return { code: 500, msg: err.message || '服务器错误', data: [] }
    }
  }

  @Get(':avatarId/accounts')
  async getAccounts(@Param('avatarId') avatarId: string) {
    try {
      const accounts = await this.avatarService.getAccounts(avatarId)
      return { code: 200, msg: 'success', data: accounts }
    } catch (err) {
      console.error('获取账号列表失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: [] }
    }
  }

  @Post('accounts')
  async createAccount(
    @Headers('x-user-id') userId: string,
    @Body() body: Record<string, any>
  ) {
    try {
      const account = await this.avatarService.createAccount({ ...body, user_id: userId })
      return { code: 200, msg: 'success', data: account }
    } catch (err) {
      console.error('创建账号失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Put('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() body: Record<string, any>
  ) {
    try {
      const account = await this.avatarService.updateAccount(id, body)
      return { code: 200, msg: 'success', data: account }
    } catch (err) {
      console.error('更新账号失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string) {
    try {
      await this.avatarService.deleteAccount(id)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      console.error('删除账号失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  /**
   * 发布内容到微信公众号草稿箱
   * Body: { accountId, title, content, imageUrls, digest? }
   */
  @Post('publish/wechat-draft')
  async publishWechatDraft(@Body() body: Record<string, any>) {
    try {
      const result = await this.avatarService.publishWechatDraft(body)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      console.error('发布公众号草稿失败:', err)
      return { code: 500, msg: err.message || '发布失败', data: null }
    }
  }
}
