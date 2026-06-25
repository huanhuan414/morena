// @ts-nocheck
import { Controller, Get, Post, Body, Headers, Query, Inject } from '@nestjs/common'
import { ReferralService } from './referral.service'

@Controller('referral')
export class ReferralController {
  private readonly referralService: ReferralService

  constructor(@Inject(ReferralService) referralService: ReferralService) {
    this.referralService = referralService
  }

  @Get('code')
  async getReferralCode(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        console.log('[ReferralController] getReferralCode userId:', userId)
        const code = await this.referralService.generateReferralCode(userId)
        console.log('[ReferralController] getReferralCode 返回:', code)
        return { code: 200, data: { referralCode: code }, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] getReferralCode error:', e.message)
    }
    return { code: 200, data: { referralCode: '' }, message: '获取成功' }
  }

  @Post('code')
  async postReferralCode(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        const code = await this.referralService.generateReferralCode(userId)
        return { code: 200, data: { referralCode: code }, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] postReferralCode error:', e.message)
    }
    return { code: 200, data: { referralCode: '' }, message: '获取成功' }
  }

  @Post('use')
  async useReferralCode(
    @Headers('x-user-id') userId: string,
    @Body('code') code: string
  ) {
    try {
      if (this.referralService) {
        const result = await this.referralService.useReferralCode(userId, code)
        return { code: 200, data: result, message: '邀请码使用成功' }
      }
    } catch (e) {
      console.error('[ReferralController] useReferralCode error:', e.message)
    }
    return { code: 500, data: null, message: '服务暂不可用' }
  }

  @Get('stats')
  async getStats(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        const stats = await this.referralService.getReferralStats(userId)
        return { code: 200, data: stats, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] getStats error:', e.message)
    }
    return { code: 200, data: { totalReferred: 0, totalEarned: 0 }, message: '获取成功' }
  }

  @Get('list')
  async getList(
    @Headers('x-user-id') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    console.log('[ReferralController] getList userId:', userId)
    console.log('[ReferralController] this.referralService:', this.referralService)
    
    try {
      if (this.referralService) {
        console.log('[ReferralController] calling getReferralList')
        const result = await this.referralService.getReferralList(
          userId,
          page ? parseInt(page) : 1,
          pageSize ? parseInt(pageSize) : 1000
        )
        // console.log('[ReferralController] getReferralList result:', result)
        return { code: 200, data: result, message: '获取成功' }
      } else {
        console.log('[ReferralController] this.referralService is null or undefined')
      }
    } catch (e) {
      console.error('[ReferralController] getList error:', e.message)
      console.error('[ReferralController] getList error stack:', e.stack)
    }
    return { code: 200, data: { list: [], total: 0 }, message: '获取成功' }
  }

  /**
   * 获取用户当前阶梯信息
   */
  @Get('tier')
  async getCurrentTier(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        const tierInfo = await this.referralService.getCurrentTier(userId)
        return { code: 200, data: tierInfo, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] getCurrentTier error:', e.message)
    }
    return { code: 200, data: { totalInvites: 0, currentTier: null, allTiers: [] }, message: '获取成功' }
  }

  /**
   * 检查每日邀请限制
   */
  @Get('daily-limit')
  async checkDailyLimit(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        const limitInfo = await this.referralService.checkDailyInviteLimit(userId)
        return { code: 200, data: limitInfo, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] checkDailyLimit error:', e.message)
    }
    return { code: 200, data: { allowed: true, current: 0, limit: 50 }, message: '获取成功' }
  }

  /**
   * 获取任务链状态
   */
  @Get('task-chain')
  async getTaskChainStatus(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        const { expired, taskChain } = await this.referralService.checkTaskChainExpiration(userId)
        return { code: 200, data: { expired, taskChain }, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] getTaskChainStatus error:', e.message)
    }
    return { code: 200, data: { expired: false, taskChain: null }, message: '获取成功' }
  }

  /**
   * 手动触发返佣（测试用）
   */
  @Post('trigger-commission')
  async triggerCommission(
    @Body() body: { referrerId: string, referredId: string, consumptionType: string, consumptionAmount: number }
  ) {
    console.log('[ReferralController] triggerCommission:', body)
    try {
      if (this.referralService) {
        await this.referralService.recordCommission(
          body.referrerId,
          body.referredId,
          body.consumptionType,
          body.consumptionAmount
        )
        return { code: 200, data: { success: true }, message: '返佣已触发' }
      }
    } catch (e) {
      console.error('[ReferralController] triggerCommission error:', e.message)
      return { code: 500, data: { success: false }, message: e.message }
    }
    return { code: 200, data: { success: false }, message: '返佣服务不可用' }
  }

  /**
   * 更新任务链状态（内部调用）
   */
  @Post('task-chain/update')
  async updateTaskChainStatus(
    @Headers('x-user-id') userId: string,
    @Body('status') status: string
  ) {
    try {
      if (this.referralService) {
        const result = await this.referralService.updateTaskChainStatus(userId, status)
        return { code: 200, data: result, message: '更新成功' }
      }
    } catch (e) {
      console.error('[ReferralController] updateTaskChainStatus error:', e.message)
    }
    return { code: 500, data: null, message: '更新失败' }
  }

  /**
   * 风控检测（内部调用）
   */
  @Post('check-risk')
  async checkRiskControl(
    @Headers('x-user-id') userId: string,
    @Body('deviceId') deviceId: string,
    @Body('ipAddress') ipAddress: string
  ) {
    try {
      if (this.referralService) {
        const riskInfo = await this.referralService.checkRiskControl(userId, deviceId, ipAddress)
        return { code: 200, data: riskInfo, message: '检测成功' }
      }
    } catch (e) {
      console.error('[ReferralController] checkRiskControl error:', e.message)
    }
    return { code: 200, data: { riskLevel: 'low', actionTaken: 'none' }, message: '检测成功' }
  }

  /**
   * 检查用户是否满足新用户首冲会员8折优惠条件
   */
  @Get('check-discount')
  async checkDiscount(@Headers('x-user-id') userId: string) {
    try {
      if (this.referralService) {
        const discountInfo = await this.referralService.checkFirstSubscriptionDiscount(userId)
        return { code: 200, data: discountInfo, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] checkDiscount error:', e.message)
    }
    return { code: 200, data: { eligible: false, discountRate: 0 }, message: '获取成功' }
  }

  /**
   * 生成邀请二维码图片
   * @param content 二维码内容（小程序页面路径）
   */
  @Post('qrcode')
  async generateQrcode(@Body('content') content: string) {
    console.log('[ReferralController] generateQrcode content:', content)
    try {
      if (this.referralService) {
        const imageUrl = await this.referralService.generateQrcodeWithLogo(content)
        return { code: 200, data: { imageUrl }, message: '生成成功' }
      }
    } catch (e) {
      console.error('[ReferralController] generateQrcode error:', e.message)
      return { code: 500, data: null, message: e.message || '生成失败' }
    }
    return { code: 500, data: null, message: '服务暂不可用' }
  }
}
