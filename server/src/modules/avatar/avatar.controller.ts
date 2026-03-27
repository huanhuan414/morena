import { Controller, Get, Post, Put, Delete, Body, Param, Headers } from '@nestjs/common'
import { AvatarService } from './avatar.service'

@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

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
}
