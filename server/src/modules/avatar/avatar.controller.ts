import { Controller, Get, Post, Put, Delete, Body, Param, Headers, UseInterceptors, UploadedFile, HttpCode } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
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
}
