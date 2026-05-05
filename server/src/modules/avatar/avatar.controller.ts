import { Controller, Get, Post, Param, Headers, Body } from '@nestjs/common'
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
}
