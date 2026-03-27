import { Controller, Get, Put, Body, Headers } from '@nestjs/common'
import { UserService } from './user.service'

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile(@Headers('x-user-id') userId: string) {
    const profile = await this.userService.getUserProfile(userId)
    return {
      code: 200,
      data: profile,
      message: '获取成功'
    }
  }

  @Put('profile')
  async updateProfile(
    @Headers('x-user-id') userId: string,
    @Body() updates: Record<string, any>
  ) {
    const profile = await this.userService.updateUserProfile(userId, updates)
    return {
      code: 200,
      data: profile,
      message: '更新成功'
    }
  }

  @Get('stats')
  async getStats(@Headers('x-user-id') userId: string) {
    const stats = await this.userService.getUserStats(userId)
    return {
      code: 200,
      data: stats,
      message: '获取成功'
    }
  }

  @Get('learning-progress')
  async getLearningProgress(@Headers('x-user-id') userId: string) {
    const progress = await this.userService.getLearningProgress(userId)
    return {
      code: 200,
      data: progress,
      message: '获取成功'
    }
  }
}
