import { Controller, Post, Body, Get, Query } from '@nestjs/common'
import { TikHubService } from './tikhub.service'

@Controller('tikhub')
export class TikHubController {
  constructor(private readonly tikhubService: TikHubService) {}

  /**
   * 验证发布内容
   * @param platform 平台标识 (douyin/kuaishou/xiaohongshu/wechat_mp)
   * @param postUrl 发布内容链接
   * @param keywords 用于比对的关键词
   */
  @Post('verify-post')
  async verifyPost(@Body() body: { platform: string; postUrl: string; keywords?: string[] }) {
    const { platform, postUrl, keywords } = body

    if (!platform) {
      return { code: 400, message: '请指定平台', data: null }
    }
    if (!postUrl) {
      return { code: 400, message: '请输入发布链接', data: null }
    }

    const result = await this.tikhubService.verifyPost(platform, postUrl, keywords || [])

    return {
      code: result.success ? 200 : 400,
      message: result.message,
      data: result.data || null,
    }
  }

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
