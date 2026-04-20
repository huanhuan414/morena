import { Controller, Post, Body, Get, Query } from '@nestjs/common'
import { TikHubService } from './tikhub.service'

@Controller('tikhub')
export class TikHubController {
  constructor(private readonly tikhubService: TikHubService) {}

  /**
   * 根据抖音号获取用户信息
   */
  @Post('douyin/user-info')
  async getDouyinUserInfo(@Body() body: { douyinId: string }) {
    const { douyinId } = body

    if (!douyinId) {
      return {
        code: 400,
        message: '请输入抖音号',
        data: null,
      }
    }

    const result = await this.tikhubService.getDouyinUserInfo(douyinId)

    if (result.success) {
      return {
        code: 200,
        message: '获取成功',
        data: result.data,
      }
    } else {
      return {
        code: 400,
        message: result.message,
        data: null,
      }
    }
  }

  /**
   * 根据小红书分享链接获取用户信息
   */
  @Post('xiaohongshu/user-info')
  async getXiaohongshuUserInfo(@Body() body: { shareUrl: string }) {
    const { shareUrl } = body

    if (!shareUrl) {
      return {
        code: 400,
        message: '请输入小红书分享链接',
        data: null,
      }
    }

    const result = await this.tikhubService.getXiaohongshuUserInfo(shareUrl)

    if (result.success) {
      return {
        code: 200,
        message: '获取成功',
        data: result.data,
      }
    } else {
      return {
        code: 400,
        message: result.message,
        data: null,
      }
    }
  }
}
