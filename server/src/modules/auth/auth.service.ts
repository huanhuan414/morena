// @ts-nocheck
import { Injectable, UnauthorizedException, BadRequestException, Inject } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { AuthSmsService } from './sms.service'
import * as crypto from 'crypto'

@Injectable()
export class AuthService {
  // 验证码缓存（生产环境应使用 Redis）
  private codeCache = new Map<string, { code: string; expiresAt: number }>()

  constructor(@Inject("AUTH_SMS_SERVICE") private readonly smsService: AuthSmsService) {}

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

    const db = getMySQLClient()
    
    // 查找用户（使用手机号作为唯一标识）
    const result = await db.query('users', { phone })
    const existingUser = (Array.isArray(result) ? result[0] : (result as any)?.data?.[0])
    
    if (existingUser) {
      // 已注册用户，直接登录
      return {
        user: existingUser,
        isNewUser: false,
        token: this.generateToken(existingUser.id),
      }
    }
    
    // 新用户，自动注册
    const userId = require('uuid').v4()
    const newUserData = {
      id: userId,
      phone,
      openid: `phone_${phone}`, // 用手机号生成唯一openid
      nickname: nickname || `用户${phone.slice(-4)}`,
      avatar: '',
      level: 1,
      exp: 0,
      credits: 100, // 新用户赠送100积分
      referral_code: this.generateReferralCode(),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
    
    const insertResult = await db.insert('users', newUserData)
    
    if (insertResult.error) {
      throw new Error(`创建用户失败: ${insertResult.error.message}`)
    }

    // 获取新创建的用户
    const newUserResult = await db.query('users', { phone })
    const newUser = (newUserResult as any)?.data?.[0]
    
    if (!newUser) {
      throw new Error('创建用户失败：未返回用户数据')
    }

    // 如果提供了邀请码，处理邀请关系并发放奖励
    let referralReward = 0
    if (referralCode && newUser) {
      try {
        const referralResult = await this.processReferral(newUser.id, referralCode)
        referralReward = referralResult.reward
      } catch (error: any) {
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
    const db = getMySQLClient()
    
    // 查找邀请人
    const inviterResult = await db.query('users', { referral_code: referralCode })
    const inviter = (inviterResult as any)?.data?.[0]
    
    if (!inviter) {
      throw new Error('邀请码无效')
    }
    
    if (inviter.id === inviteeId) {
      throw new Error('不能使用自己的邀请码')
    }
    
    // 创建邀请记录
    await db.insert('referrals', {
      referrer_id: inviter.id,
      referee_id: inviteeId,
      referral_code: referralCode,
      status: 'completed',
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    
    // 发放邀请奖励（给邀请人）
    const REWARD_AMOUNT = 10 // 邀请奖励金额
    const REWARD_CREDITS = 50 // 邀请奖励积分
    
    // 添加收益记录
    await db.insert('earnings', {
      user_id: inviter.id,
      type: 'referral_bonus',
      amount: REWARD_AMOUNT,
      description: `邀请新用户奖励`,
      status: 'settled',
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    
    // 更新邀请人余额和总收益
    await db.update('users', inviter.id, {
      credits: inviter.credits + REWARD_CREDITS,
      total_earnings: (inviter.total_earnings || 0) + REWARD_AMOUNT,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    })
    
    return { inviterId: inviter.id, reward: REWARD_AMOUNT }
  }

  /**
   * 微信登录
   */
  async wechatLogin(code: string): Promise<{ user: any; token: string; isNewUser: boolean }> {
    // 调用微信接口获取 openid
    const wxAppId = process.env.WX_APP_ID
    const wxAppSecret = process.env.WX_APP_SECRET
    
    if (!wxAppId || !wxAppSecret) {
      throw new Error('微信配置未设置')
    }
    
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${wxAppId}&secret=${wxAppSecret}&js_code=${code}&grant_type=authorization_code`
    
    try {
      const wxResponse = await fetch(wxUrl)
      const wxData = await wxResponse.json()
      
      if (wxData.errcode) {
        throw new Error(`微信登录失败: ${wxData.errmsg}`)
      }
      
      const openid = wxData.openid
      const sessionKey = wxData.session_key
      
      // 查找或创建用户
      return await this.createOrGetUser(openid)
    } catch (error: any) {
      throw new Error(`微信登录失败: ${error.message}`)
    }
  }

  /**
   * 创建或获取微信用户
   */
  private async createOrGetUser(openid: string, nickname?: string, avatar?: string) {
    const db = getMySQLClient()
    
    // 查找用户
    const result = await db.query('users', { openid })
    const existingUser = (Array.isArray(result) ? result[0] : (result as any)?.data?.[0])
    
    if (existingUser) {
      return {
        user: existingUser,
        token: this.generateToken(existingUser.id),
        isNewUser: false,
      }
    }
    
    // 创建新用户
    const userId = require('uuid').v4()
    const newUserData = {
      id: userId,
      openid,
      nickname: nickname || '微信用户',
      avatar: avatar || '',
      level: 1,
      exp: 0,
      credits: 100,
      referral_code: this.generateReferralCode(),
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
    
    await db.insert('users', newUserData)
    
    // 获取新创建的用户
    const newUserResult = await db.query('users', { openid })
    const newUser = (newUserResult as any)?.data?.[0]
    
    if (!newUser) {
      throw new Error('创建用户失败')
    }
    
    return {
      user: newUser,
      token: this.generateToken(newUser.id),
      isNewUser: true,
    }
  }

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('请先登录')
    }
    
    const token = authHeader.substring(7)
    const userId = this.verifyToken(token)
    
    if (!userId) {
      throw new UnauthorizedException('登录已过期')
    }
    
    const db = getMySQLClient()
    const result = await db.query('users', { id: userId })
    const user = (Array.isArray(result) ? result[0] : (result as any)?.data?.[0])
    
    if (!user) {
      throw new UnauthorizedException('用户不存在')
    }
    
    return { user }
  }

  /**
   * 根据ID获取用户
   */
  async getUserById(userId: string) {
    const db = getMySQLClient()
    const result = await db.query('users', { id: userId })
    return (Array.isArray(result) ? result[0] : (result as any)?.data?.[0])
  }

  /**
   * 生成 JWT token（简化版）
   */
  private generateToken(userId: string): string {
    const payload = { userId, iat: Date.now() }
    const secret = process.env.JWT_SECRET || 'morena-secret-key'
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64')
    const signature = crypto.createHmac('sha256', secret).update(encoded).digest('hex')
    return `${encoded}.${signature}`
  }

  /**
   * 验证 token
   */
  private verifyToken(token: string): string | null {
    try {
      const [encoded, signature] = token.split('.')
      const secret = process.env.JWT_SECRET || 'morena-secret-key'
      const expectedSignature = crypto.createHmac('sha256', secret).update(encoded).digest('hex')
      
      if (signature !== expectedSignature) {
        return null
      }
      
      const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
      
      // 检查 token 是否过期（7天）
      if (Date.now() - payload.iat > 7 * 24 * 60 * 60 * 1000) {
        return null
      }
      
      return payload.userId
    } catch {
      return null
    }
  }

  /**
   * 生成邀请码
   */
  private generateReferralCode(): string {
    return crypto.randomBytes(4).toString('hex').toUpperCase()
  }
}
