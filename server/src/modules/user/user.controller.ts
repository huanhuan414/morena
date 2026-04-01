import { Controller, Get, Put, Post, Body, Headers } from '@nestjs/common'
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

  @Get('security-status')
  async getSecurityStatus(@Headers('x-user-id') userId: string) {
    const status = await this.userService.getSecurityStatus(userId)
    return {
      code: 200,
      data: status,
      message: '获取成功'
    }
  }

  @Post('change-password')
  async changePassword(
    @Headers('x-user-id') userId: string,
    @Body() body: { oldPassword: string; newPassword: string }
  ) {
    await this.userService.changePassword(userId, body.oldPassword, body.newPassword)
    return {
      code: 200,
      data: null,
      message: '密码修改成功'
    }
  }
}
