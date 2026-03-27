import { Injectable, UnauthorizedException } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class AuthService {
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
