import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class EarningService {
  /**
   * 获取用户收益概览
   */
  async getEarningsOverview(userId: string) {
    const client = getSupabaseClient()
    
    // 获取用户信息
    const { data: user } = await client
      .from('users')
      .select('balance, total_earnings')
      .eq('id', userId)
      .single()
    
    // 获取待结算收益
    const { data: pendingEarnings } = await client
      .from('earnings')
      .select('amount')
      .eq('user_id', userId)
      .eq('status', 'pending')
    
    const pendingAmount = pendingEarnings?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
    
    // 获取本月收益
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    
    const { data: monthlyEarnings } = await client
      .from('earnings')
      .select('amount')
      .eq('user_id', userId)
      .gte('created_at', monthStart)
    
    const monthlyAmount = monthlyEarnings?.reduce((sum, e) => sum + Number(e.amount), 0) || 0
    
    // 获取收益统计
    const { count: totalOrders } = await client
      .from('earnings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'order_reward')
    
    const { count: totalReferrals } = await client
      .from('earnings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('type', 'referral_bonus')
    
    return {
      balance: user?.balance || 0,
      totalEarnings: user?.total_earnings || 0,
      pendingAmount,
      monthlyAmount,
      totalOrders: totalOrders || 0,
      totalReferrals: totalReferrals || 0
    }
  }

  /**
   * 获取收益明细
   */
  async getEarningsList(userId: string, options?: {
    type?: string
    status?: string
    page?: number
    pageSize?: number
  }) {
    const client = getSupabaseClient()
    
    const page = options?.page || 1
    const pageSize = options?.pageSize || 20
    const offset = (page - 1) * pageSize
    
    let query = client
      .from('earnings')
      .select('*, avatars(name), orders(title)', { count: 'exact' })
      .eq('user_id', userId)
    
    if (options?.type) {
      query = query.eq('type', options.type)
    }
    
    if (options?.status) {
      query = query.eq('status', options.status)
    }
    
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取收益明细失败: ${error.message}`)
    }
    
    return {
      list: data || [],
      total: count || 0,
      page,
      pageSize
    }
  }

  /**
   * 创建收益记录
   */
  async createEarning(data: {
    userId: string
    avatarId?: string
    orderId?: string
    type: string
    amount: number
    description?: string
  }) {
    const client = getSupabaseClient()
    
    const { data: earning, error } = await client
      .from('earnings')
      .insert({
        user_id: data.userId,
        avatar_id: data.avatarId,
        order_id: data.orderId,
        type: data.type,
        amount: data.amount,
        description: data.description,
        status: 'pending'
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建收益记录失败: ${error.message}`)
    }
    
    return earning
  }

  /**
   * 结算收益
   */
  async settleEarning(earningId: string) {
    const client = getSupabaseClient()
    
    // 获取收益记录
    const { data: earning } = await client
      .from('earnings')
      .select('*')
      .eq('id', earningId)
      .single()
    
    if (!earning) {
      throw new Error('收益记录不存在')
    }
    
    if (earning.status !== 'pending') {
      throw new Error('该收益已结算')
    }
    
    // 更新收益状态
    await client
      .from('earnings')
      .update({ status: 'settled' })
      .eq('id', earningId)
    
    // 更新用户余额
    await client
      .from('users')
      .update({
        balance: client.rpc('increment_balance', { amount: earning.amount }),
        total_earnings: client.rpc('increment_total_earnings', { amount: earning.amount })
      })
      .eq('id', earning.user_id)
    
    // 手动更新余额
    const { data: user } = await client
      .from('users')
      .select('balance, total_earnings')
      .eq('id', earning.user_id)
      .single()
    
    const newBalance = (user?.balance || 0) + Number(earning.amount)
    const newTotal = (user?.total_earnings || 0) + Number(earning.amount)
    
    await client
      .from('users')
      .update({
        balance: newBalance,
        total_earnings: newTotal
      })
      .eq('id', earning.user_id)
    
    return { success: true, newBalance }
  }

  /**
   * 订单完成后自动结算
   */
  async settleOrderEarnings(orderId: string) {
    const client = getSupabaseClient()
    
    // 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('*, avatars(user_id, name)')
      .eq('id', orderId)
      .single()
    
    if (!order || !order.avatars) {
      return
    }
    
    // 计算收益金额（预算的80%给分身主人，20%平台抽成）
    const orderBudget = Number(order.budget) || 0
    const rewardAmount = orderBudget * 0.8
    
    if (rewardAmount > 0) {
      await this.createEarning({
        userId: order.avatars.user_id,
        avatarId: order.avatar_id,
        orderId: orderId,
        type: 'order_reward',
        amount: rewardAmount,
        description: `完成订单「${order.title}」奖励`
      })
    }
  }

  /**
   * 创建提现申请
   */
  async createWithdrawal(userId: string, data: {
    amount: number
    method: string
    accountInfo: Record<string, any>
  }) {
    const client = getSupabaseClient()
    
    // 检查余额
    const { data: user } = await client
      .from('users')
      .select('balance')
      .eq('id', userId)
      .single()
    
    if (!user || Number(user.balance) < data.amount) {
      throw new Error('余额不足')
    }
    
    if (data.amount < 1) {
      throw new Error('最低提现金额为1元')
    }
    
    // 创建提现记录
    const { data: withdrawal, error } = await client
      .from('withdrawals')
      .insert({
        user_id: userId,
        amount: data.amount,
        method: data.method,
        account_info: data.accountInfo,
        status: 'pending'
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建提现申请失败: ${error.message}`)
    }
    
    // 冻结余额
    await client
      .from('users')
      .update({
        balance: Number(user.balance) - data.amount
      })
      .eq('id', userId)
    
    return withdrawal
  }

  /**
   * 获取提现记录
   */
  async getWithdrawals(userId: string, page = 1, pageSize = 20) {
    const client = getSupabaseClient()
    const offset = (page - 1) * pageSize
    
    const { data, error, count } = await client
      .from('withdrawals')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      throw new Error(`获取提现记录失败: ${error.message}`)
    }
    
    return {
      list: data || [],
      total: count || 0,
      page,
      pageSize
    }
  }

  /**
   * 处理提现（管理员操作）
   */
  async processWithdrawal(withdrawalId: string, status: string, transactionId?: string) {
    const client = getSupabaseClient()
    
    const { data: withdrawal } = await client
      .from('withdrawals')
      .select('*')
      .eq('id', withdrawalId)
      .single()
    
    if (!withdrawal) {
      throw new Error('提现记录不存在')
    }
    
    const updates: any = {
      status,
      processed_at: new Date().toISOString()
    }
    
    if (transactionId) {
      updates.transaction_id = transactionId
    }
    
    await client
      .from('withdrawals')
      .update(updates)
      .eq('id', withdrawalId)
    
    // 如果提现失败，退还余额
    if (status === 'failed') {
      const { data: user } = await client
        .from('users')
        .select('balance')
        .eq('id', withdrawal.user_id)
        .single()
      
      await client
        .from('users')
        .update({
          balance: Number(user?.balance || 0) + Number(withdrawal.amount)
        })
        .eq('id', withdrawal.user_id)
    }
    
    return { success: true }
  }
}
