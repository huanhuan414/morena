// @ts-nocheck
import { Controller, Get, Post, Body, Headers, Query, Inject, InternalServerErrorException } from '@nestjs/common'
import { ReferralService } from './referral.service'
import { requireAuthenticatedUserId } from '../../common/auth-user.util'

@Controller('referral')
export class ReferralController {
  private readonly referralService: ReferralService

  constructor(@Inject(ReferralService) referralService: ReferralService) {
    this.referralService = referralService
  }

  @Get('code')
  async getReferralCode(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
    try {
      if (this.referralService) {
        const code = await this.referralService.generateReferralCode(userId)
        return { code: 200, data: { referralCode: code }, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] getReferralCode error:', e.message)
    }
    return { code: 200, data: { referralCode: '' }, message: '获取成功' }
  }

  @Post('code')
  async postReferralCode(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body('code') code: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    try {
      if (this.referralService) {
        const result = await this.referralService.useReferralCode(userId, code)
        return { code: 200, data: result, message: '邀请码使用成功' }
      }
    } catch (e) {
      console.error('[ReferralController] useReferralCode error:', e.message)
    }
    throw new InternalServerErrorException({ msg: '服务暂不可用', data: null })
  }

  @Get('stats')
  async getStats(@Headers() headers: Record<string, string | string[] | undefined>) {
    const userId = requireAuthenticatedUserId(headers)
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
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    const userId = requireAuthenticatedUserId(headers)
    try {
      if (this.referralService) {
        const result = await this.referralService.getReferralList(
          userId,
          page ? parseInt(page) : 1,
          pageSize ? parseInt(pageSize) : 20
        )
        return { code: 200, data: result, message: '获取成功' }
      }
    } catch (e) {
      console.error('[ReferralController] getList error:', e.message)
    }
    return { code: 200, data: { list: [], total: 0 }, message: '获取成功' }
  }
}
