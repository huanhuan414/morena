import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { NotificationService } from '../notification/notification.service'

export interface AvatarScore {
  id: string
  name: string
  score: number
  completionRate: number
  level: number
  totalOrders: number
  completedOrders: number
  skillMatchScore: number
  platformMatchScore: number
  reason: string[]
}

export interface DispatchResult {
  orderId: string
  avatarId: string
  avatarName: string
  score: number
  reason: string[]
}

@Injectable()
export class OrderDispatchService {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * 智能订单分配算法
   * 根据订单需求和分身能力进行多维度匹配
   */
  async dispatchOrder(orderId: string): Promise<DispatchResult | null> {
    const client = getSupabaseClient()
    
    // 1. 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (!order) {
      throw new Error('订单不存在')
    }

    // 如果订单已有分配，不重复分配
    if (order.avatar_id) {
      console.log('[分身调度] 订单已分配，跳过')
      return null
    }
    
    // 2. 获取所有活跃分身及其平台配置
    const { data: avatars } = await client
      .from('avatars')
      .select(`
        *,
        platform_configs(*)
      `)
      .eq('status', 'active')
    
    if (!avatars || avatars.length === 0) {
      console.log('[分身调度] 暂无活跃分身，订单保持待接单状态')
      return null
    }
    
    // 3. 获取用户信息和通知偏好
    const userIds = [...new Set(avatars.map(a => a.user_id))]
    const { data: users } = await client
      .from('users')
      .select('id, phone, notification_settings')
      .in('id', userIds)
    
    const userMap = new Map(users?.map(u => [u.id, u]) || [])
    
    // 4. 计算每个分身的综合评分
    const scoredAvatars = avatars.map(avatar => {
      const user = userMap.get(avatar.user_id)
      return this.calculateAvatarScore(avatar, order, user)
    })
    
    // 5. 过滤出开启托管或有可用通知的分身
    const eligibleAvatars = scoredAvatars.filter(avatar => {
      // 如果开启托管，直接可用
      if (avatar.is_hosted) return true
      // 如果用户有手机号且允许通知，也可用（需要人工确认）
      const user = userMap.get(avatar.id)
      return user?.phone && user?.notification_settings?.order_dispatch !== false
    })
    
    if (eligibleAvatars.length === 0) {
      console.log('[分身调度] 没有符合条件的分身，订单保持待接单状态')
      return null
    }
    
    // 6. 按评分排序
    eligibleAvatars.sort((a, b) => b.score - a.score)
    
    // 7. 选择评分最高的分身
    const selectedAvatar = eligibleAvatars[0]
    const avatarUser = userMap.get(selectedAvatar.user_id)
    
    // 8. 根据托管状态决定是否自动分配
    if (selectedAvatar.is_hosted) {
      // 自动分配
      await this.assignOrderToAvatar(orderId, selectedAvatar.id)
      
      // 发送应用内通知
      await this.notificationService.createNotification(selectedAvatar.user_id, {
        type: 'system',
        title: '订单自动分配',
        content: `您的分身"${selectedAvatar.name}"已自动接取订单：${order.title}`,
        data: { orderId, avatarId: selectedAvatar.id }
      })
      
    } else {
      // 发送确认请求
      await this.sendDispatchRequest(orderId, selectedAvatar, avatarUser, order)
    }
    
    // 9. 返回分配结果
    return {
      orderId,
      avatarId: selectedAvatar.id,
      avatarName: selectedAvatar.name,
      score: selectedAvatar.score,
      reason: selectedAvatar.reason
    }
  }

  /**
   * 计算分身综合评分
   * 包含：订单匹配度、技能匹配、平台匹配、基础能力
   */
  private calculateAvatarScore(
    avatar: any, 
    order: any, 
    user: any,
    platformConfigMap?: Map<string, any[]>
  ): AvatarScore & { user_id: string; is_hosted: boolean } {
    const requirements = order.requirements || {}
    const reasons: string[] = []
    
    // ========== 基础能力评分 (40%) ==========
    const completionRate = avatar.completion_rate || 100
    const level = avatar.level || 1
    const completedOrders = avatar.completed_orders || 0
    const totalOrders = avatar.total_orders || 0
    
    // 完成率评分 (0-100)
    const baseScore = completionRate * 0.4
    
    // 等级评分 (1-100映射)
    const levelScore = Math.min(level * 5, 100) * 0.3
    
    // 经验评分 (基于完成订单数)
    const expScore = Math.min(completedOrders * 3, 100) * 0.2
    
    // 活跃度评分 (托管状态)
    const activityScore = avatar.is_hosted ? 100 : 50
    
    // ========== 技能匹配评分 (30%) ==========
    // 技能要求可以从 requirements.required_skills 或从 targetAudience 推断
    const skills = avatar.skills || []
    const requiredSkills = requirements.required_skills || []
    let skillMatchScore = 50 // 默认匹配度
    
    if (requiredSkills.length > 0) {
      const matchedSkills = skills.filter(s => requiredSkills.includes(s))
      skillMatchScore = (matchedSkills.length / requiredSkills.length) * 100
      if (matchedSkills.length > 0) {
        reasons.push(`技能匹配: ${matchedSkills.join(', ')}`)
      }
    } else {
      // 如果没有明确技能要求，所有分身都获得基础分
      skillMatchScore = 80
    }
    
    // ========== 平台匹配评分 (30%) ==========
    const platforms = requirements.platforms || []
    // 从 platformConfigMap 获取用户的平台配置，而不是不存在的 avatar.platform_configs
    const userPlatformConfigs = platformConfigMap?.get(avatar.user_id) || []
    const avatarPlatforms = userPlatformConfigs.map(c => c.platform_type) || []
    let platformMatchScore = 50 // 默认匹配度
    
    if (platforms.length > 0) {
      const matchedPlatforms = platforms.filter(p => avatarPlatforms.includes(p))
      platformMatchScore = (matchedPlatforms.length / platforms.length) * 100
      if (matchedPlatforms.length > 0) {
        reasons.push(`平台匹配: ${matchedPlatforms.join(', ')}`)
      }
    } else {
      // 如果没有明确平台要求，所有分身都获得较高基础分
      platformMatchScore = 70
    }
    }
    
    // ========== 预算匹配评分 (额外加分) ==========
    const budget = order.budget || 0
    let budgetBonus = 0
    if (budget >= 1000 && level >= 5) {
      budgetBonus = 10
      reasons.push('高预算订单匹配')
    }
    
    // ========== 综合评分 ==========
    const skillWeight = 0.3
    const platformWeight = 0.3
    const totalScore = 
      baseScore * 0.4 +
      levelScore +
      expScore +
      activityScore * 0.1 +
      skillMatchScore * skillWeight +
      platformMatchScore * platformWeight +
      budgetBonus
    
    // 基础能力说明
    if (completionRate >= 95) reasons.push('完成率优秀')
    if (level >= 5) reasons.push('等级较高')
    if (completedOrders >= 10) reasons.push('经验丰富')
    
    return {
      user_id: avatar.user_id,
      id: avatar.id,
      name: avatar.name,
      score: Math.round(totalScore * 100) / 100,
      completionRate,
      level,
      totalOrders,
      completedOrders,
      skillMatchScore,
      platformMatchScore,
      reason: reasons,
      is_hosted: avatar.is_hosted || false
    }
  }

  /**
   * 自动分配订单给分身
   */
  private async assignOrderToAvatar(orderId: string, avatarId: string) {
    const client = getSupabaseClient()
    
    // 更新订单状态
    await client
      .from('orders')
      .update({
        avatar_id: avatarId,
        status: 'in_progress',
        assigned_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
    
    // 更新分身订单计数
    const { data: avatar } = await client
      .from('avatars')
      .select('total_orders')
      .eq('id', avatarId)
      .single()
    
    await client
      .from('avatars')
      .update({
        total_orders: (avatar?.total_orders || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
    
    // 创建执行步骤
    await this.createExecutionSteps(orderId, avatarId)
  }

  /**
   * 发送分配确认请求
   */
  private async sendDispatchRequest(
    orderId: string, 
    avatar: AvatarScore & { user_id: string }, 
    user: any,
    order: any
  ) {
    const client = getSupabaseClient()
    
    // 创建待确认的分配记录
    await client
      .from('order_dispatch_requests')
      .insert({
        order_id: orderId,
        avatar_id: avatar.id,
        user_id: avatar.user_id,
        status: 'pending',
        score: avatar.score,
        match_reasons: avatar.reason,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24小时过期
      })
    
    // 发送通知
    await this.notificationService.createNotification(avatar.user_id, {
      type: 'system',
      title: '订单分配请求',
      content: `有新的订单等待您确认：${order.title}`,
      data: { orderId, avatarId: avatar.id, type: 'dispatch_request' }
    })
    
    // 如果有手机号，发送短信
    if (user?.phone) {
      // TODO: 集成短信服务
      console.log(`[分身调度] 发送短信通知到 ${user.phone}`)
    }
  }

  /**
   * 确认订单分配
   */
  async confirmDispatch(requestId: string, avatarId: string): Promise<boolean> {
    const client = getSupabaseClient()
    
    // 验证请求
    const { data: request } = await client
      .from('order_dispatch_requests')
      .select('*')
      .eq('id', requestId)
      .eq('avatar_id', avatarId)
      .eq('status', 'pending')
      .single()
    
    if (!request) {
      throw new Error('分配请求不存在或已过期')
    }
    
    if (new Date(request.expires_at) < new Date()) {
      throw new Error('分配请求已过期')
    }
    
    // 更新请求状态
    await client
      .from('order_dispatch_requests')
      .update({ status: 'accepted' })
      .eq('id', requestId)
    
    // 分配订单
    await this.assignOrderToAvatar(request.order_id, avatarId)
    
    return true
  }

  /**
   * 拒绝订单分配
   */
  async rejectDispatch(requestId: string, avatarId: string): Promise<boolean> {
    const client = getSupabaseClient()
    
    await client
      .from('order_dispatch_requests')
      .update({ status: 'rejected' })
      .eq('id', requestId)
      .eq('avatar_id', avatarId)
    
    return true
  }

  /**
   * 创建订单执行步骤
   */
  private async createExecutionSteps(orderId: string, avatarId: string) {
    const client = getSupabaseClient()
    
    const steps = [
      { step_number: 1, step_name: '需求分析', description: '分析订单需求，制定执行方案' },
      { step_number: 2, step_name: '内容创作', description: '根据要求生成内容' },
      { step_number: 3, step_name: '内容审核', description: '审核生成的内容' },
      { step_number: 4, step_name: '平台发布', description: '将内容发布到目标平台' },
      { step_number: 5, step_name: '数据追踪', description: '追踪发布后的数据反馈' }
    ]
    
    const stepRecords = steps.map(step => ({
      order_id: orderId,
      avatar_id: avatarId,
      ...step,
      status: 'pending'
    }))
    
    await client
      .from('order_executions')
      .insert(stepRecords)
  }

  /**
   * 获取订单执行进度
   */
  async getExecutionProgress(orderId: string) {
    const client = getSupabaseClient()
    
    const { data: executions } = await client
      .from('order_executions')
      .select('*')
      .eq('order_id', orderId)
      .order('step_number', { ascending: true })
    
    return executions || []
  }

  /**
   * 更新执行步骤状态
   */
  async updateExecutionStep(executionId: string, status: string, result?: any) {
    const client = getSupabaseClient()
    
    const updates: any = {
      status,
      updated_at: new Date().toISOString()
    }
    
    if (status === 'in_progress') {
      updates.started_at = new Date().toISOString()
    } else if (status === 'completed') {
      updates.completed_at = new Date().toISOString()
    }
    
    if (result) {
      updates.result = result
    }
    
    const { data, error } = await client
      .from('order_executions')
      .update(updates)
      .eq('id', executionId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新执行步骤失败: ${error.message}`)
    }
    
    // 如果步骤完成，检查是否需要进入下一步
    if (status === 'completed') {
      await this.moveToNextStep(data.order_id, data.step_number)
    }
    
    return data
  }

  /**
   * 进入下一步骤
   */
  private async moveToNextStep(orderId: string, currentStep: number) {
    const client = getSupabaseClient()
    
    const { data: nextStep } = await client
      .from('order_executions')
      .select('id')
      .eq('order_id', orderId)
      .eq('step_number', currentStep + 1)
      .single()
    
    if (nextStep) {
      await client
        .from('order_executions')
        .update({ status: 'in_progress', started_at: new Date().toISOString() })
        .eq('id', nextStep.id)
    } else {
      // 所有步骤完成，更新订单状态
      await client
        .from('orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', orderId)
    }
  }

  /**
   * 获取订单分配状态
   */
  async getDispatchStatus(orderId: string) {
    const client = getSupabaseClient()
    
    const { data: order } = await client
      .from('orders')
      .select('*, avatars(name, avatar_url, level)')
      .eq('id', orderId)
      .single()
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    // 获取待确认的分配请求
    const { data: pendingRequest } = await client
      .from('order_dispatch_requests')
      .select('*, avatars(name)')
      .eq('order_id', orderId)
      .eq('status', 'pending')
      .single()
    
    // 获取执行进度
    const executions = await this.getExecutionProgress(orderId)
    
    return {
      order,
      pendingRequest,
      executions,
      currentStep: executions.find(e => e.status === 'in_progress') || null
    }
  }

  /**
   * 获取推荐分身列表
   * @param orderId 订单ID
   * @param limit 返回数量限制，0或负数表示返回全部
   */
  async getRecommendedAvatars(orderId: string, limit: number = 0) {
    const client = getSupabaseClient()
    
    // 获取订单信息
    const { data: order } = await client
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single()
    
    if (!order) {
      throw new Error('订单不存在')
    }
    
    const requirements = order.requirements || {}
    
    // 获取所有活跃分身
    const { data: avatars } = await client
      .from('avatars')
      .select('*')
      .eq('status', 'active')
    
    if (!avatars || avatars.length === 0) {
      return []
    }
    
    // 获取所有用户的平台配置
    const userIds = [...new Set(avatars.map(a => a.user_id))]
    const { data: platformConfigs } = await client
      .from('platform_configs')
      .select('*')
      .in('user_id', userIds)
    
    // 按 user_id 构建平台配置映射
    const platformConfigMap = new Map<string, any[]>()
    platformConfigs?.forEach(config => {
      const existing = platformConfigMap.get(config.user_id) || []
      existing.push(config)
      platformConfigMap.set(config.user_id, existing)
    })
    
    // 计算每个分身的推荐评分
    const scoredAvatars = avatars.map(avatar => 
      this.calculateAvatarScore(avatar, order, null, platformConfigMap)
    )
    
    // 按评分排序并返回
    scoredAvatars.sort((a, b) => b.score - a.score)
    
    // 当 limit <= 0 时返回全部，否则返回前N个
    const result = limit <= 0 ? scoredAvatars : scoredAvatars.slice(0, limit)
    
    return result.map(avatar => ({
      id: avatar.id,
      name: avatar.name,
      avatar_url: (avatar as any).avatar_url || '',
      level: avatar.level,
      score: avatar.score,
      matchReasons: avatar.reason,
      isHosted: avatar.is_hosted,
      completionRate: avatar.completionRate,
      completedOrders: avatar.completedOrders
    }))
  }

  /**
   * 取消订单分配
   */
  async cancelDispatch(orderId: string, userId: string) {
    const client = getSupabaseClient()
    
    // 验证订单所有权
    const { data: order } = await client
      .from('orders')
      .select('user_id, avatar_id, status')
      .eq('id', orderId)
      .single()
    
    if (!order || order.user_id !== userId) {
      throw new Error('无权操作此订单')
    }
    
    if (order.status === 'completed') {
      throw new Error('已完成的订单无法取消')
    }
    
    // 重置订单状态
    await client
      .from('orders')
      .update({
        avatar_id: null,
        status: 'open',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId)
    
    // 如果有待确认请求，标记为已取消
    await client
      .from('order_dispatch_requests')
      .update({ status: 'cancelled' })
      .eq('order_id', orderId)
      .eq('status', 'pending')
    
    // 如果有已分配的分身，减少其订单计数
    if (order.avatar_id) {
      const { data: avatar } = await client
        .from('avatars')
        .select('total_orders')
        .eq('id', order.avatar_id)
        .single()
      
      await client
        .from('avatars')
        .update({
          total_orders: Math.max((avatar?.total_orders || 1) - 1, 0),
          updated_at: new Date().toISOString()
        })
        .eq('id', order.avatar_id)
    }
    
    return true
  }
}
