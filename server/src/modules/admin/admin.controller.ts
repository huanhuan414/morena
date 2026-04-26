import { Controller, Post, Body, Get, Query, Headers, Param } from '@nestjs/common'
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
   * 获取用户详情
   */
  @Get('users/:id')
  async getUserDetail(
    @Headers('authorization') token: string,
    @Param('id') userId: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const user = await this.adminService.getUserDetail(userId)
    return {
      code: user ? 200 : 404,
      data: user,
      message: user ? 'success' : '用户不存在'
    }
  }

  /**
   * 获取用户统计数据
   */
  @Get('users/:id/stats')
  async getUserStats(
    @Headers('authorization') token: string,
    @Param('id') userId: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const stats = await this.adminService.getUserStats(userId)
    return {
      code: 200,
      data: stats,
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

  /**
   * 获取分身列表
   */
  @Get('avatars')
  async getAvatars(
    @Headers('authorization') token: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getAvatars(page, limit, keyword, status)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 切换分身状态
   */
  @Post('avatars/toggle-status')
  async toggleAvatarStatus(
    @Headers('authorization') token: string,
    @Body('avatar_id') avatarId: string,
    @Body('status') status: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.updateAvatarStatus(avatarId, status)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 获取订单列表
   */
  @Get('orders')
  async getOrders(
    @Headers('authorization') token: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getOrders(page, limit, keyword, status)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 更新订单状态
   */
  @Post('orders/update-status')
  async updateOrderStatus(
    @Headers('authorization') token: string,
    @Body('order_id') orderId: string,
    @Body('status') status: string
  ) {
    const admin = await this.adminService.verifyToken(token)
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.updateOrderStatus(orderId, status)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }
}
