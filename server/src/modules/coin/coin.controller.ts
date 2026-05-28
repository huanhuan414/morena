import { Controller, Get, Post, Body, Query, Inject } from '@nestjs/common'
import { CoinService } from './coin.service'

@Controller('coin')
export class CoinController {
  private readonly coinService: CoinService

  constructor(@Inject(CoinService) coinService: CoinService) {
    this.coinService = coinService
  }

  @Get('balance')
  async getBalance(@Query('userId') userId: string) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    try {
      const balance = await this.coinService.getBalance(userId)
      return { code: 200, data: { balance }, message: '获取成功' }
    } catch (e: any) {
      console.error('[CoinController] getBalance error:', e.message)
      return { code: 500, data: null, message: '获取失败' }
    }
  }

  @Get('prices')
  async getPrices() {
    try {
      const prices = await this.coinService.getAllSkillPrices()
      return { code: 200, data: prices, message: '获取成功' }
    } catch (e: any) {
      console.error('[CoinController] getPrices error:', e.message)
      return { code: 500, data: null, message: '获取失败' }
    }
  }

  @Get('can-consume')
  async canConsume(
    @Query('userId') userId: string,
    @Query('skillType') skillType: string
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!skillType) return { code: 400, data: null, message: '缺少技能类型' }
    try {
      const result = await this.coinService.canConsume(userId, skillType)
      return { code: 200, data: result, message: '检查成功' }
    } catch (e: any) {
      console.error('[CoinController] canConsume error:', e.message)
      return { code: 500, data: null, message: '检查失败' }
    }
  }

  @Post('consume')
  async consume(
    @Body('userId') userId: string,
    @Body('skillType') skillType: string,
    @Body('amount') amount?: number
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!skillType) return { code: 400, data: null, message: '缺少技能类型' }
    try {
      const result = await this.coinService.consume(userId, skillType, amount)
      return { code: 200, data: result, message: '消费成功' }
    } catch (e: any) {
      console.error('[CoinController] consume error:', e.message)
      return { code: 400, data: null, message: e.message || '消费失败' }
    }
  }

  @Post('gift')
  async gift(
    @Body('userId') userId: string,
    @Body('amount') amount: number,
    @Body('description') description: string
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!amount || amount <= 0) return { code: 400, data: null, message: '金额无效' }
    try {
      const result = await this.coinService.gift(userId, amount, description || '系统赠送')
      return { code: 200, data: result, message: '赠送成功' }
    } catch (e: any) {
      console.error('[CoinController] gift error:', e.message)
      return { code: 500, data: null, message: e.message || '赠送失败' }
    }
  }

  @Get('transactions')
  async getTransactions(
    @Query('userId') userId: string,
    @Query('type') type?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    try {
      const result = await this.coinService.getTransactions(userId, {
        type,
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20
      })
      return { code: 200, data: result, message: '获取成功' }
    } catch (e: any) {
      console.error('[CoinController] getTransactions error:', e.message)
      return { code: 500, data: null, message: '获取失败' }
    }
  }

  @Get('recharge-packages')
  async getRechargePackages() {
    try {
      const packages = await this.coinService.getRechargePackages()
      return { code: 200, data: packages, message: '获取成功' }
    } catch (e: any) {
      console.error('[CoinController] getRechargePackages error:', e.message)
      return { code: 500, data: null, message: '获取失败' }
    }
  }

  @Post('recharge')
  async createRecharge(
    @Body('userId') userId: string,
    @Body('packageId') packageId: string,
    @Body('paymentMethod') paymentMethod?: string
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    if (!packageId) return { code: 400, data: null, message: '请选择充值套餐' }
    try {
      const result = await this.coinService.createRechargeOrder(userId, packageId, paymentMethod || 'wechat')
      return { code: 200, data: result, message: '创建订单成功' }
    } catch (e: any) {
      console.error('[CoinController] createRecharge error:', e.message)
      return { code: 400, data: null, message: e.message || '创建订单失败' }
    }
  }

  @Post('recharge-callback')
  async rechargeCallback(
    @Body('orderId') orderId: string,
    @Body('transactionId') transactionId: string
  ) {
    if (!orderId) return { code: 400, data: null, message: '缺少订单ID' }
    if (!transactionId) return { code: 400, data: null, message: '缺少交易号' }
    try {
      const result = await this.coinService.rechargeCallback(orderId, transactionId)
      return { code: 200, data: result, message: '充值成功' }
    } catch (e: any) {
      console.error('[CoinController] rechargeCallback error:', e.message)
      return { code: 400, data: null, message: e.message || '充值失败' }
    }
  }

  @Get('recharge-records')
  async getRechargeRecords(
    @Query('userId') userId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string
  ) {
    if (!userId) return { code: 401, data: null, message: '请先登录' }
    try {
      const result = await this.coinService.getRechargeRecords(userId, {
        page: page ? Number(page) : 1,
        pageSize: pageSize ? Number(pageSize) : 20
      })
      return { code: 200, data: result, message: '获取成功' }
    } catch (e: any) {
      console.error('[CoinController] getRechargeRecords error:', e.message)
      return { code: 500, data: null, message: '获取失败' }
    }
  }
}
