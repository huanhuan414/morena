import { Controller, Get, Post, Put, Delete, Param, Headers, Body } from '@nestjs/common'
import { AvatarService } from './avatar.service'

@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

  @Get()
  async getMyAvatars(@Headers('x-user-id') userId: string) {
    try {
      const avatars = await this.avatarService.getAvatarsByUser(userId)
      return { code: 200, msg: 'success', data: avatars }
    } catch (err) {
      console.error('获取分身列表失败:', err)
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Post()
  async createAvatar(
    @Headers('x-user-id') userId: string,
    @Body() body: { name: string; avatar_url: string; description?: string; platform?: string; accounts?: any[] }
  ) {
    try {
      console.log('创建分身请求:', { userId, name: body.name, platform: body.platform })
      const avatar = await this.avatarService.createAvatar(userId, {
        name: body.name,
        avatar_url: body.avatar_url,
        description: body.description || '',
        platform: body.platform || '通用'
      })
      
      // 如果有账号数据，创建账号关联
      if (body.accounts && body.accounts.length > 0 && avatar && avatar.id) {
        for (const account of body.accounts) {
          await this.avatarService.createAccount(avatar.id, account)
        }
      }
      
      return { code: 200, msg: 'success', data: avatar }
    } catch (err) {
      console.error('创建分身失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Get('active')
  async getActiveAvatars() {
    try {
      const avatars = await this.avatarService.getActiveAvatars(10)
      return { code: 200, msg: 'success', data: avatars }
    } catch (err) {
      console.error('获取活跃分身失败:', err)
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  @Get(':id')
  async getAvatarDetail(@Param('id') id: string) {
    try {
      const avatar = await this.avatarService.findById(id)
      if (!avatar) {
        return { code: 404, msg: '分身不存在', data: null }
      }
      
      // 格式化返回数据
      const formattedAvatar = {
        id: avatar.id,
        name: avatar.name,
        avatar_url: avatar.avatar_url,
        level: avatar.level || 1,
        description: avatar.description || '',
        completed_orders: avatar.completed_orders || 0,
        total_earnings: 0, // 需要从 earnings 表计算
        rating: 5.0 // 默认评分
      }
      
      return { code: 200, msg: 'success', data: formattedAvatar }
    } catch (err) {
      console.error('获取分身详情失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }

  @Put(':id')
  async updateAvatar(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() body: {
      name?: string
      personality?: string
      avatar_url?: string
      description?: string
      config?: Record<string, any>
      latitude?: number
      longitude?: number
      location_text?: string
    }
  ) {
    try {
      console.log('[AvatarController] 更新分身:', id, body)
      const avatar = await this.avatarService.updateAvatar(id, userId, body)
      if (!avatar) {
        return { code: 404, msg: '分身不存在', data: null }
      }
      return { code: 200, msg: 'success', data: avatar }
    } catch (err) {
      console.error('更新分身失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Get(':id/orders')
  async getAvatarOrders(@Param('id') id: string) {
    try {
      const orders = await this.avatarService.getAvatarOrders(id)
      return { code: 200, msg: 'success', data: orders }
    } catch (err) {
      console.error('获取分身订单失败:', err)
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  /**
   * 获取分身好友列表
   */
  @Get(':id/friends')
  async getAvatarFriends(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      const friends = await this.avatarService.getAvatarFriends(id, userId)
      return { code: 200, msg: 'success', data: friends }
    } catch (err) {
      console.error('获取好友列表失败:', err)
      return { code: 500, msg: '服务器错误', data: [] }
    }
  }

  /**
   * 接受好友请求
   */
  @Post(':id/friends/:friendId/accept')
  async acceptFriendRequest(
    @Param('id') id: string,
    @Param('friendId') friendId: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      await this.avatarService.acceptFriendRequest(id, friendId, userId)
      return { code: 200, msg: '已接受好友请求' }
    } catch (err) {
      console.error('接受好友请求失败:', err)
      return { code: 500, msg: '服务器错误' }
    }
  }

  /**
   * 拒绝好友请求
   */
  @Post(':id/friends/:friendId/reject')
  async rejectFriendRequest(
    @Param('id') id: string,
    @Param('friendId') friendId: string,
    @Headers('x-user-id') userId: string
  ) {
    try {
      await this.avatarService.rejectFriendRequest(id, friendId, userId)
      return { code: 200, msg: '已拒绝好友请求' }
    } catch (err) {
      console.error('拒绝好友请求失败:', err)
      return { code: 500, msg: '服务器错误' }
    }
  }

  /**
   * 开启/关闭托管
   */
  @Post(':id/hosting')
  async toggleHosting(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() body: { enabled: boolean; settings?: any }
  ) {
    try {
      const { enabled, settings } = body
      const avatar = await this.avatarService.findById(id)
      
      if (!avatar) {
        return { code: 404, msg: '分身不存在', data: null }
      }
      
      // 使用 updateAvatar 方法更新托管状态
      await this.avatarService.updateAvatar(id, userId, {
        is_hosted: enabled
      })
      
      // 如果有额外设置，也更新
      if (settings) {
        await this.avatarService.updateHostingSettings(id, userId, settings)
      }
      
      return { 
        code: 200, 
        msg: enabled ? '托管已开启' : '托管已关闭', 
        data: { enabled } 
      }
    } catch (err) {
      console.error('托管操作失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  /**
   * 更新托管设置
   */
  @Put(':id/hosting/settings')
  async updateHostingSettings(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string,
    @Body() body: any
  ) {
    try {
      const result = await this.avatarService.updateHostingSettings(id, userId, body)
      return { code: 200, msg: '设置已更新', data: result }
    } catch (err) {
      console.error('更新托管设置失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  /**
   * 获取分身学习数据
   */
  @Post('accounts')
  async createAccount(
    @Body() body: any
  ) {
    try {
      console.log('[AvatarController] 创建账号:', body)
      const account = await this.avatarService.createAccount(body.avatar_id, body)
      return { code: 200, msg: 'success', data: account }
    } catch (err) {
      console.error('[AvatarController] 创建账号失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Put('accounts/:id')
  async updateAccount(
    @Param('id') id: string,
    @Body() body: any
  ) {
    try {
      console.log('[AvatarController] 更新账号:', id, body)
      const account = await this.avatarService.updateAccount(id, body)
      return { code: 200, msg: 'success', data: account }
    } catch (err) {
      console.error('[AvatarController] 更新账号失败:', err)
      return { code: 500, msg: err.message || '服务器错误', data: null }
    }
  }

  @Delete('accounts/:id')
  async deleteAccount(@Param('id') id: string) {
    try {
      console.log('[AvatarController] 删除账号:', id)
      await this.avatarService.deleteAccount(id)
      return { code: 200, msg: 'success' }
    } catch (err) {
      console.error('[AvatarController] 删除账号失败:', err)
      return { code: 500, msg: err.message || '服务器错误' }
    }
  }

  @Get(':id/learning')
  async getLearningData(@Param('id') id: string) {
    try {
      const avatar = await this.avatarService.findById(id)
      
      if (!avatar) {
        return { code: 404, msg: '分身不存在', data: null }
      }
      
      const learningData = avatar.learning_data || {
        messageCount: 0,
        avgMessageLength: 0,
        toneProfile: {},
        personalityTraits: {},
        communicationStyle: {},
        interests: [],
        commonPhrases: [],
        userIdentity: {}
      }
      
      const metrics = {
        learningDays: Math.floor((Date.now() - new Date(avatar.created_at).getTime()) / (1000 * 60 * 60 * 24)),
        lastActiveTime: avatar.updated_at
      }
      
      return { 
        code: 200, 
        msg: 'success', 
        data: { 
          learning: learningData,
          metrics
        } 
      }
    } catch (err) {
      console.error('获取学习数据失败:', err)
      return { code: 500, msg: '服务器错误', data: null }
    }
  }
}
