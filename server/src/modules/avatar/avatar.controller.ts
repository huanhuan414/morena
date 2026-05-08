// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Param, Headers, Body, Query } from '@nestjs/common'
import { AvatarService } from './avatar.service'

@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post()
  async createAvatar(
    @Headers('x-user-id') userId: string,
    @Body() body: { name: string; avatar_url?: string; description?: string; gender?: string; age?: number }
  ) {
    try {
      const avatar = await this.avatarService.createAvatar(userId, {
        name: body.name,
        avatar_url: body.avatar_url || '',
        description: body.description || '',
        gender: body.gender,
        age: body.age
      })
      return { code: 200, msg: 'success', data: avatar }
    } catch (err) {
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Get()
  async getAllAvatars(@Headers('x-user-id') userId?: string) {
    try {
      if (userId) {
        const avatars = await this.avatarService.getUserAvatars(userId)
        return { code: 200, msg: 'success', data: avatars.data }
      }
      const result = await this.avatarService.getUserAvatars('')
      return { code: 200, msg: 'success', data: result.data || [] }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Get('active')
  async getActiveAvatars(@Query('limit') limit?: string) {
    try {
      const result = await this.avatarService.getUserAvatars('')
      return { code: 200, msg: 'success', data: result.data?.slice(0, parseInt(limit || '10')) || [] }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Get(':id')
  async getAvatarDetail(@Param('id') id: string) {
    try {
      const result = await this.avatarService.getAvatarById(parseInt(id))
      if (!result.data) {
        return { code: 404, msg: '分身不存在', data: null }
      }
      return { code: 200, msg: 'success', data: result.data }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Put(':id')
  async updateAvatar(
    @Param('id') id: string,
    @Body() body: { name?: string; avatar_url?: string; description?: string }
  ) {
    try {
      const result = await this.avatarService.updateAvatar(parseInt(id), body)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id')
  async deleteAvatar(@Param('id') id: string, @Headers('x-user-id') userId: string) {
    try {
      const result = await this.avatarService.deleteAvatar(parseInt(id), userId)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Get(':id/skills')
  async getSkills(@Param('id') id: string) {
    try {
      const result = await this.avatarService.getSkills(parseInt(id))
      return { code: 200, msg: 'success', data: result.data }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Post(':id/skills')
  async addSkill(@Param('id') id: string, @Body() body: any) {
    try {
      const result = await this.avatarService.addSkill(parseInt(id), body)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id/skills/:skillId')
  async deleteSkill(@Param('skillId') skillId: string) {
    try {
      const result = await this.avatarService.deleteSkill(parseInt(skillId))
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Get(':id/memories')
  async getMemories(@Param('id') id: string) {
    try {
      const result = await this.avatarService.getMemories(parseInt(id))
      return { code: 200, msg: 'success', data: result.data }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Post(':id/memories')
  async addMemory(@Param('id') id: string, @Body() body: any) {
    try {
      const result = await this.avatarService.addMemory(parseInt(id), body)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id/memories/:memoryId')
  async deleteMemory(@Param('memoryId') memoryId: string) {
    try {
      const result = await this.avatarService.deleteMemory(parseInt(memoryId))
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Get(':id/stats')
  async getStats(@Param('id') id: string) {
    try {
      const result = await this.avatarService.getStats(parseInt(id))
      return { code: 200, msg: 'success', data: result.data }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }
}
