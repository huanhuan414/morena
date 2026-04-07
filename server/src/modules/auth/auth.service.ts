import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { SmsService } from './sms.service'

@Injectable()
export class AuthService {
  // 验证码缓存（生产环境应使用 Redis）
  private codeCache = new Map<string, { code: string; expiresAt: number }>()

  constructor(private readonly smsService: SmsService) {}

  /**
   * 发送验证码
   */
  async sendVerificationCode(phone: string): Promise<{ success: boolean; message: string }> {
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('请输入正确的手机号')
    }

    // 检查发送频率限制（60秒内不能重复发送）
    const cached = this.codeCache.get(phone)
    if (cached && cached.expiresAt > Date.now() + 4 * 60 * 1000) {
      // 如果验证码还没过期且还在60秒冷却期内
      const remainingTime = Math.ceil((cached.expiresAt - 4 * 60 * 1000 - Date.now()) / 1000)
      if (remainingTime > 0) {
        throw new BadRequestException(`${remainingTime}秒后可重新发送`)
      }
    }

    // 生成验证码
    const code = this.smsService.generateCode()
    
    // 存储验证码（5分钟有效）
    this.codeCache.set(phone, {
      code,
      expiresAt: Date.now() + 5 * 60 * 1000,
    })

    // 发送短信
    const result = await this.smsService.sendVerificationCode(phone, code)
    
    console.log(`[验证码] 手机号: ${phone}, 验证码: ${code}`)
    
    return result
  }

  /**
   * 手机号验证码登录/注册
   * 如果用户不存在则自动注册
   * 支持邀请码参数，注册成功后自动发放邀请奖励
   */
  async phoneLogin(phone: string, code: string, nickname?: string, referralCode?: string): Promise<{
    user: any
    isNewUser: boolean
    token: string
    referralReward?: number
  }> {
    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      throw new BadRequestException('请输入正确的手机号')
    }

    // 验证验证码
    const cached = this.codeCache.get(phone)
    if (!cached) {
      throw new BadRequestException('请先获取验证码')
    }

    if (cached.expiresAt < Date.now()) {
      this.codeCache.delete(phone)
      throw new BadRequestException('验证码已过期，请重新获取')
    }

    if (cached.code !== code) {
      throw new BadRequestException('验证码错误')
    }

    // 验证成功，删除验证码
    this.codeCache.delete(phone)

    const client = getSupabaseClient()
    
    // 查找用户（使用手机号作为唯一标识）
    const { data: existingUser, error: findError } = await client
      .from('users')
      .select('*')
      .eq('phone', phone)
      .maybeSingle()
    
    if (findError) {
      throw new Error(`查询用户失败: ${findError.message}`)
    }
    
    if (existingUser) {
      // 已注册用户，直接登录
      return {
        user: existingUser,
        isNewUser: false,
        token: this.generateToken(existingUser.id),
      }
    }
    
    // 新用户，自动注册
    const { data: newUser, error: createError } = await client
      .from('users')
      .insert({
        phone,
        openid: `phone_${phone}`, // 用手机号生成唯一openid
        nickname: nickname || `用户${phone.slice(-4)}`,
        avatar: '',
        level: 1,
        exp: 0,
        credits: 100, // 新用户赠送100积分
      })
      .select()
      .single()
    
    if (createError) {
      throw new Error(`创建用户失败: ${createError.message}`)
    }

    // 如果提供了邀请码，处理邀请关系并发放奖励
    let referralReward = 0
    if (referralCode && newUser) {
      try {
        const referralResult = await this.processReferral(newUser.id, referralCode)
        referralReward = referralResult.reward
      } catch (error) {
        // 邀请码处理失败不影响注册，但记录日志
        console.error('[AuthService] 处理邀请码失败:', error.message)
      }
    }
    
    return {
      user: newUser,
      isNewUser: true,
      token: this.generateToken(newUser.id),
      referralReward
    }
  }

  /**
   * 处理邀请关系并发放奖励
   */
  private async processReferral(inviteeId: string, referralCode: string): Promise<{ inviterId: string; reward: number }> {
    const client = getSupabaseClient()
    
    // 查找邀请人
    const { data: inviter } = await client
      .from('users')
      .select('id')
      .eq('referral_code', referralCode)
      .single()
    
    if (!inviter) {
      throw new Error('邀请码无效')
    }
    
    if (inviter.id === inviteeId) {
      throw new Error('不能使用自己的邀请码')
    }
    
    // 检查是否已被邀请
    const { data: existingReferral } = await client
      .from('referrals')
      .select('id')
      .eq('invitee_id', inviteeId)
      .single()
    
    if (existingReferral) {
      throw new Error('您已被邀请过')
    }
    
    // 创建邀请记录
    const { error: referralError } = await client
      .from('referrals')
      .insert({
        inviter_id: inviter.id,
        invitee_id: inviteeId,
        status: 'registered'
      })
    
    if (referralError) {
      throw new Error(`创建邀请记录失败: ${referralError.message}`)
    }
    
    // 更新被邀请人的邀请人字段
    await client
      .from('users')
      .update({ invited_by: inviter.id })
      .eq('id', inviteeId)
    
    // 发放邀请奖励（给邀请人）
    const REWARD_AMOUNT = 10 // 邀请奖励金额
    const REWARD_CREDITS = 50 // 邀请奖励积分
    
    // 添加收益记录
    await client
      .from('earnings')
      .insert({
        user_id: inviter.id,
        type: 'referral_bonus',
        amount: REWARD_AMOUNT,
        description: `邀请新用户奖励`,
        status: 'settled'
      })
    
    // 更新邀请人余额和总收益
    const { data: inviterData } = await client
      .from('users')
      .select('balance, total_earnings, credits')
      .eq('id', inviter.id)
      .single()
    
    await client
      .from('users')
      .update({
        balance: (inviterData?.balance || 0) + REWARD_AMOUNT,
        total_earnings: (inviterData?.total_earnings || 0) + REWARD_AMOUNT,
        credits: (inviterData?.credits || 0) + REWARD_CREDITS
      })
      .eq('id', inviter.id)
    
    console.log(`[AuthService] 邀请奖励发放成功: 邀请人=${inviter.id}, 被邀请人=${inviteeId}, 奖励金额=${REWARD_AMOUNT}, 积分=${REWARD_CREDITS}`)
    
    return {
      inviterId: inviter.id,
      reward: REWARD_AMOUNT
    }
  }

  async wechatLogin(code: string) {
    // 微信小程序登录
    const wxAppId = process.env.WX_APP_ID
    const wxSecret = process.env.WX_APP_SECRET
    
    if (!wxAppId || !wxSecret) {
      // 开发环境：使用模拟登录
      console.log('开发环境：模拟微信登录')
      const mockOpenid = `dev_${Date.now()}`
      return this.createOrGetUser(mockOpenid, '模拟用户', undefined)
    }

    try {
      const response = await fetch(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxSecret}&js_code=${code}&grant_type=authorization_code`
      )
      const data = await response.json()
      
      if (data.errcode) {
        throw new UnauthorizedException(`微信登录失败: ${data.errmsg}`)
      }

      return this.createOrGetUser(data.openid, '微信用户', undefined)
    } catch (error) {
      console.error('微信登录错误:', error)
      throw new UnauthorizedException('登录失败，请重试')
    }
  }

  private async createOrGetUser(openid: string, nickname: string, avatar?: string) {
    const client = getSupabaseClient()
    
    // 查找用户
    const { data: existingUser, error: findError } = await client
      .from('users')
      .select('*')
      .eq('openid', openid)
      .maybeSingle()
    
    if (findError) {
      throw new Error(`查询用户失败: ${findError.message}`)
    }
    
    if (existingUser) {
      return {
        user: existingUser,
        isNewUser: false,
        token: this.generateToken(existingUser.id)
      }
    }
    
    // 创建新用户
    const { data: newUser, error: createError } = await client
      .from('users')
      .insert({
        openid,
        nickname: nickname || '莫瑞娜用户',
        avatar: avatar || '',
        level: 1,
        exp: 0,
        credits: 100 // 新用户赠送100积分
      })
      .select()
      .single()
    
    if (createError) {
      throw new Error(`创建用户失败: ${createError.message}`)
    }
    
    return {
      user: newUser,
      isNewUser: true,
      token: this.generateToken(newUser.id)
    }
  }

  private generateToken(userId: string) {
    // 简单的 token 生成（生产环境应使用 JWT）
    return Buffer.from(`${userId}:${Date.now()}`).toString('base64')
  }

  async getUserById(userId: string) {
    const client = getSupabaseClient()
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', userId)
      .single()
    
    if (error) {
      throw new Error(`获取用户失败: ${error.message}`)
    }
    
    return data
  }
}
