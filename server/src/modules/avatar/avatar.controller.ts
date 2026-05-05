import { Controller, Get, Param } from '@nestjs/common'
import { AvatarService } from './avatar.service'

@Controller('avatar')
export class AvatarController {
  constructor(private readonly avatarService: AvatarService) {}

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
