import { Controller, Post, Body, Get, Query, Headers, UseGuards } from '@nestjs/common'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * 管理员登录
   */
  @Post('login')
  async login(@Body('username') username: string, @Body('password') password: string) {
    const result = await this.adminService.login(username, password)
    return {
      code: result.success ? 200 : 401,
      data: result.data,
      message: result.message
    }
  }

  /**
   * 获取仪表盘统计数据
   */
  @Get('dashboard/stats')
  async getDashboardStats(@Headers('authorization') token: string) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const stats = await this.adminService.getDashboardStats()
    return {
      code: 200,
      data: stats,
      message: 'success'
    }
  }

  /**
   * 获取用户列表
   */
  @Get('users')
  async getUsers(
    @Headers('authorization') token: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('keyword') keyword?: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getUsers(page, limit, keyword)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 禁用/解禁用户
   */
  @Post('users/ban')
  async banUser(
    @Headers('authorization') token: string,
    @Body('user_id') userId: string,
    @Body('action') action: 'ban' | 'unban'
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.banUser(userId, action)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }
}
