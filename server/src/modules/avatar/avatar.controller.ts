// @ts-nocheck
import { Controller, Get, Post, Put, Delete, Param, Headers, Body, Query, Inject } from '@nestjs/common'
import { AvatarService } from './avatar.service'

@Controller('avatar')
export class AvatarController {
  constructor(@Inject('AVATAR_SERVICE') private readonly avatarService: AvatarService) {}

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
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Get('search')
  async searchAvatars(@Query('keyword') keyword: string) {
    try {
      const result = await this.avatarService.searchAvatars(keyword)
      return { code: 200, msg: 'success', data: result }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Get(':id')
  async getAvatarDetail(@Param('id') id: string) {
    try {
      const avatar = await this.avatarService.getAvatarById(id)
      return { code: 200, msg: 'success', data: avatar }
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
      await this.avatarService.updateAvatar(id, {
        name: body.name,
        avatar_url: body.avatar_url,
        description: body.description
      })
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Delete(':id')
  async deleteAvatar(@Param('id') id: string) {
    try {
      await this.avatarService.deleteAvatar(id)
      return { code: 200, msg: 'success', data: null }
    } catch (err) {
      return { code: 500, msg: '服务器错误', data: null }
    }
  }
}
