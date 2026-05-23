// @ts-nocheck
import { Injectable, Logger } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

export interface ValidateResult {
  success: boolean
  platform: string
  data?: {
    title?: string
    author?: string
    cover?: string
    description?: string
    url?: string
    views?: number
    likes?: number
    comments?: number
    shares?: number
  }
  error?: string
}

@Injectable()
export class LinkValidationService {
  private readonly logger = new Logger(LinkValidationService.name)

  /**
   * 验证链接并获取作品信息
   */
  async validateLink(url: string, orderId?: string, avatarId?: string): Promise<ValidateResult> {
    try {
      if (!url || typeof url !== 'string') {
        return {
          success: false,
          platform: 'unknown',
          error: '链接不能为空'
        }
      }

      this.logger.log(`[LinkValidation] 开始验证链接: ${url}`)

      // 识别平台
      const platform = this.detectPlatform(url)
      if (!platform) {
        return {
          success: false,
          platform: 'unknown',
          error: '无法识别链接所属平台'
        }
      }

      this.logger.log(`[LinkValidation] 识别到平台: ${platform}`)

      // 根据平台验证
      switch (platform) {
        case 'douyin':
          return await this.validateDouyin(url)
        case 'xiaohongshu':
          return await this.validateXiaohongshu(url)
        case 'wechat':
          return await this.validateWechat(url)
        default:
          return {
            success: false,
            platform,
            error: '暂不支持该平台'
          }
      }
    } catch (error) {
      this.logger.error(`[LinkValidation] 验证失败: ${error.message}`)
      return {
        success: false,
        platform: 'unknown',
        error: error.message
      }
    }
  }

  /**
   * 检测链接平台
   */
  private detectPlatform(url: string): string | null {
    if (url.includes('douyin.com') || url.includes('iesdouyin.com')) {
      return 'douyin'
    }
    if (url.includes('xiaohongshu.com') || url.includes('xhslink.com')) {
      return 'xiaohongshu'
    }
    if (url.includes('mp.weixin.qq.com') || url.includes('weixin://')) {
      return 'wechat'
    }
    if (url.includes('bilibili.com')) {
      return 'bilibili'
    }
    if (url.includes('weibo.com')) {
      return 'weibo'
    }
    return null
  }

  /**
   * 验证抖音链接
   */
  private async validateDouyin(url: string): Promise<ValidateResult> {
    // 简化实现，实际需要调用抖音API
    return {
      success: true,
      platform: 'douyin',
      data: {
        url,
        title: '抖音作品',
        description: '抖音内容'
      }
    }
  }

  /**
   * 验证小红书链接
   */
  private async validateXiaohongshu(url: string): Promise<ValidateResult> {
    // 简化实现，实际需要调用小红书API
    return {
      success: true,
      platform: 'xiaohongshu',
      data: {
        url,
        title: '小红书笔记',
        description: '小红书内容'
      }
    }
  }

  /**
   * 验证微信公众号链接
   */
  private async validateWechat(url: string): Promise<ValidateResult> {
    return {
      success: true,
      platform: 'wechat',
      data: {
        url,
        title: '微信公众号文章',
        description: '微信内容'
      }
    }
  }
}
