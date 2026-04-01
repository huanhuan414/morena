import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { EarningService } from '../earning/earning.service'

@Injectable()
export class ReferralService {
  constructor(private readonly earningService: EarningService) {}

  /**
   * 生成邀请码
   */
  async generateReferralCode(userId: string): Promise<string> {
    const client = getSupabaseClient()
    
    // 检查是否已有邀请码
    const { data: user } = await client
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single()
    
    if (user?.referral_code) {
      return user.referral_code
    }
    
    // 生成唯一邀请码（6位大写字母+数字）
    const code = this.generateUniqueCode()
    
    await client
      .from('users')
      .update({ referral_code: code })
      .eq('id', userId)
    
    return code
  }

  /**
   * 生成唯一邀请码
   */
  private generateUniqueCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code = ''
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return code
  }

  /**
   * 使用邀请码注册
   */
  async useReferralCode(inviteeId: string, code: string) {
    const client = getSupabaseClient()
    
    // 查找邀请人
    const { data: inviter } = await client
      .from('users')
      .select('id')
      .eq('referral_code', code)
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
    const { error } = await client
      .from('referrals')
      .insert({
        inviter_id: inviter.id,
        invitee_id: inviteeId,
        status: 'registered'
      })
    
    if (error) {
      throw new Error(`创建邀请记录失败: ${error.message}`)
    }
    
    // 更新被邀请人的邀请人字段
    await client
      .from('users')
      .update({ invited_by: inviter.id })
      .eq('id', inviteeId)
    
    return { success: true, inviterId: inviter.id }
  }

  /**
   * 获取邀请统计
   */
  async getReferralStats(userId: string) {
    const client = getSupabaseClient()
    
    // 获取邀请码，如果没有则自动生成
    const { data: user } = await client
      .from('users')
      .select('referral_code')
      .eq('id', userId)
      .single()
    
    let referralCode = user?.referral_code
    
    // 如果没有邀请码，自动生成一个
    if (!referralCode) {
      referralCode = await this.generateReferralCode(userId)
    }
    
    // 获取邀请人数
    const { count: totalInvited } = await client
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', userId)
    
    // 获取有效邀请人数（已活跃）
    const { count: activeInvited } = await client
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', userId)
      .eq('status', 'active')
    
    // 获取已获得奖励的人数
    const { count: rewardedInvited } = await client
      .from('referrals')
      .select('*', { count: 'exact', head: true })
      .eq('inviter_id', userId)
      .eq('status', 'rewarded')
    
    // 获取邀请奖励总额
    const { data: earnings } = await client
      .from('earnings')
      .select('amount')
      .eq('user_id', userId)
      .eq('type', 'referral_bonus')
    
    const totalReward = earnings?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
    
    return {
      referralCode: referralCode || '',
      totalInvited: totalInvited || 0,
      activeInvited: activeInvited || 0,
      rewardedInvited: rewardedInvited || 0,
      totalReward
    }
  }

  /**
   * 获取邀请列表
   */
  async getReferralList(userId: string, page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    const { data, error, count } = await client
      .from('referrals')
      .select('*, invitee:users!referrals_invitee_id_fkey(nickname, avatar, created_at)', { count: 'exact' })
      .eq('inviter_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取邀请列表失败: ${error.message}`)
    }
    
    return {
      list: data || [],
      total: count || 0,
      page,
      pageSize
    }
  }

  /**
   * 奖励邀请人
   * 当被邀请人完成首次订单后触发
   */
  async rewardInviter(inviteeId: string) {
    const client = getSupabaseClient()
    
    // 获取邀请记录
    const { data: referral } = await client
      .from('referrals')
      .select('*, inviter:users!referrals_inviter_id_fkey(id)')
      .eq('invitee_id', inviteeId)
      .single()
    
    if (!referral || referral.status === 'rewarded') {
      return
    }
    
    // 更新邀请状态
    await client
      .from('referrals')
      .update({
        status: 'rewarded',
        reward_amount: 10,
        rewarded_at: new Date().toISOString()
      })
      .eq('id', referral.id)
    
    // 创建收益记录
    await this.earningService.createEarning({
      userId: referral.inviter_id,
      type: 'referral_bonus',
      amount: 10,
      description: '邀请好友奖励'
    })
    
    // 自动结算
    const { data: earnings } = await client
      .from('earnings')
      .select('id')
      .eq('user_id', referral.inviter_id)
      .eq('type', 'referral_bonus')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (earnings && earnings.length > 0) {
      await this.earningService.settleEarning(earnings[0].id)
    }
    
    return { success: true }
  }

  /**
   * 更新邀请状态为活跃
   */
  async activateReferral(userId: string) {
    const client = getSupabaseClient()
    
    await client
      .from('referrals')
      .update({ status: 'active' })
      .eq('invitee_id', userId)
      .eq('status', 'registered')
  }
}
