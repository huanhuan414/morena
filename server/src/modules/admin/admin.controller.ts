import { Inject, Controller, Post, Body, Get, Query, Headers, Param, Put, Delete } from '@nestjs/common'
import { AdminService } from './admin.service'

@Controller('admin')
export class AdminController {
  constructor(@Inject(AdminService) private readonly adminService: AdminService) {}

  private getAdminAuthHeader(headers: Record<string, string | string[] | undefined>): string | undefined {
    const authorization = headers.authorization ?? headers.Authorization
    const adminToken = headers['admin_token'] ?? headers['admin-token'] ?? headers['Admin-Token']

    const firstValue = (value: string | string[] | undefined): string | undefined =>
      Array.isArray(value) ? value[0] : value

    return firstValue(authorization) ?? firstValue(adminToken)
  }

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
  async getDashboardStats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
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

  // ===== 用户管理 =====

  /**
   * 获取用户列表
   */
  @Get('users')
  async getUsers(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('keyword') keyword?: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') userId: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') userId: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('user_id') userId: string,
    @Body('action') action: 'ban' | 'unban'
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.banUser(userId, action === 'ban')
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message || '操作完成'
    }
  }

  // ===== 分身管理 =====

  /**
   * 获取分身列表
   */
  @Get('avatars')
  async getAvatars(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getAvatars(page, limit)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('avatar_id') avatarId: string,
    @Body('status') status: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
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

  // ===== 订单管理 =====

  /**
   * 获取订单列表
   */
  @Get('orders')
  async getOrders(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('keyword') keyword?: string,
    @Query('status') status?: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getOrders(page, limit, status)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  @Get('orders/acceptance-overdue')
  async getAcceptanceOverdueOrders(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('hours') hours: number = 6,
    @Query('limit') limit: number = 50
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }

    const result = await this.adminService.getAcceptanceOverdueOrders(Number(hours) || 6, Number(limit) || 50)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('order_id') orderId: string,
    @Body('status') status: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
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

  // ===== 技能管理 =====

  /**
   * 获取技能列表
   */
  @Get('skills')
  async getSkills(@Headers() headers: Record<string, string | string[] | undefined>) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getSkills(1, 100)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 创建技能
   */
  @Post('skills')
  async createSkill(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() data: any
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.createSkill(data)
    return {
      code: result.success ? 200 : 400,
      data: result.data,
      message: result.message
    }
  }

  /**
   * 更新技能
   */
  @Put('skills/:id')
  async updateSkill(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body() data: any
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.updateSkill(id, data)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 删除技能
   */
  @Delete('skills/:id')
  async deleteSkill(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.deleteSkill(id)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 切换技能状态
   */
  @Put('skills/:id/status')
  async toggleSkillStatus(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.updateSkillStatus(id, status)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  // ===== 内容管理 =====

  /**
   * 获取帖子列表
   */
  @Get('posts')
  async getPosts(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('status') status?: string,
    @Query('search') search?: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const page = parseInt(search || '1', 10);
    const result = await this.adminService.getPosts(page, 20, status)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 审核帖子
   */
  @Put('posts/:id/review')
  async reviewPost(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body('status') status: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.reviewPost(id, status)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 删除帖子
   */
  @Delete('posts/:id')
  async deletePost(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.deletePost(id)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  // ===== 财务管理 =====

  /**
   * 获取财务统计
   */
  @Get('finance/stats')
  async getFinanceStats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const stats = await this.adminService.getFinanceStats()
    return {
      code: 200,
      data: stats,
      message: 'success'
    }
  }

  /**
   * 获取交易记录
   */
  @Get('finance/transactions')
  async getTransactions(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('type') type?: string,
    @Query('page') pageStr?: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const page = parseInt(pageStr || '1', 10);
    const result = await this.adminService.getTransactions(page, 20, type)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 审核提现通过
   */
  @Post('finance/withdraw/:id/approve')
  async approveWithdraw(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.approveWithdraw(id)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 审核提现驳回
   */
  @Post('finance/withdraw/:id/reject')
  async rejectWithdraw(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string,
    @Body('reason') reason: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.rejectWithdraw(id, reason)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  // ===== 推广管理 =====

  /**
   * 获取推广统计
   */
  @Get('referral/stats')
  async getReferralStats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const stats = await this.adminService.getReferralStats()
    return {
      code: 200,
      data: stats,
      message: 'success'
    }
  }

  /**
   * 获取推广员列表
   */
  @Get('referral/list')
  async getReferrers(@Headers() headers: Record<string, string | string[] | undefined>) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getReferrers(1, 100)
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 更新分佣设置
   */
  @Put('referral/settings')
  async updateReferralSettings(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('commissionRate') rate: number
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.updateCommissionRate(rate)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  // ===== 系统设置 =====

  /**
   * 获取管理员列表
   */
  @Get('settings/admins')
  async getAdmins(@Headers() headers: Record<string, string | string[] | undefined>) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.getAdmins()
    return {
      code: 200,
      data: result,
      message: 'success'
    }
  }

  /**
   * 添加管理员
   */
  @Post('settings/admins')
  async addAdmin(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('username') username: string,
    @Body('password') password: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.addAdmin(username, password)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 删除管理员
   */
  @Delete('settings/admins/:id')
  async deleteAdmin(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Param('id') id: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.deleteAdmin(id)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message
    }
  }

  /**
   * 修改密码
   */
  @Put('settings/password')
  async changePassword(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('oldPassword') oldPassword: string,
    @Body('newPassword') newPassword: string
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.changePassword(admin.id, newPassword)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.message || '密码修改成功'
    }
  }

  /**
   * 获取系统配置
   */
  @Get('settings/config')
  async getConfig(@Headers() headers: Record<string, string | string[] | undefined>): Promise<{ code: number; data: any; message: string }> {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const config = await this.adminService.getSystemConfig()
    return {
      code: 200,
      data: config,
      message: 'success'
    }
  }

  /**
   * 更新系统配置
   */
  @Put('settings/config')
  async updateConfig(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() config: any
  ) {
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(headers))
    if (!admin) {
      return { code: 401, data: null, message: '未授权' }
    }
    
    const result = await this.adminService.updateSystemConfig(config)
    return {
      code: result.success ? 200 : 400,
      data: null,
      message: result.success ? '配置更新成功' : '配置更新失败'
    }
  }
}
