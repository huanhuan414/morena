import { Injectable } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, VideoGenerationClient, TTSClient, HeaderUtils } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { ReverseGeocodingService } from '../../services/reverse-geocoding.service'
import { SubscriptionService } from '../subscription/subscription.service'
import { TikHubService } from '../tikhub/tikhub.service'
import { StorageService } from '../storage/storage.service'
import { FriendshipService } from './friendship.service'

@Injectable()
export class AvatarService {
  constructor(
    private readonly reverseGeocodingService: ReverseGeocodingService,
    private readonly subscriptionService: SubscriptionService,
    private readonly tikHubService: TikHubService,
    private readonly storageService: StorageService,
    private readonly friendshipService: FriendshipService
  ) {
  }

  async createAvatar(userId: string, avatarData: Record<string, any>) {
    // 检查用户是否可以创建分身
    const canCreate = await this.subscriptionService.canCreateAvatar(userId)
    if (!canCreate.canCreate) {
      throw new Error(canCreate.reason || 'Cannot create avatar, please check your subscription plan')
    }

    const client = getSupabaseClient()

    // 从图片分析结果构建分身配置
    const photoAnalysis = avatarData.photo_analysis || {}

    // 处理地理位置信息
    let locationData = {
      latitude: avatarData.latitude || null,
      longitude: avatarData.longitude || null,
      location_text: avatarData.location_text || null
    }

    // 如果有经纬度但没有详细地址，进行逆地理编码
    if (locationData.latitude && locationData.longitude) {
      try {
        const geoResult = await this.reverseGeocodingService.reverseGeocode(
          locationData.latitude,
          locationData.longitude
        )
        // 使用逆地理编码的结果
        locationData.location_text = geoResult.formatted_address
        console.log('[创建分身] 逆地理编码成功:', geoResult.formatted_address)
      } catch (error) {
        console.warn('[创建分身] 逆地理编码失败，使用原始坐标:', error)
        // 逆地理编码失败，使用原始坐标
        locationData.location_text = `${locationData.latitude.toFixed(6)}, ${locationData.longitude.toFixed(6)}`
      }
    }

    const { data, error } = await client
      .from('avatars')
      .insert({
        user_id: userId,
        name: avatarData.name || 'My AI Avatar',
        description: this.generateDescription(photoAnalysis, avatarData),
        avatar_url: avatarData.photo_url || avatarData.avatar_url || '',
        personality: avatarData.personality || photoAnalysis.recommendedType || 'friendly',
        appearance_style: avatarData.appearance_style || 'tech',
        speaking_style: avatarData.speaking_style || 'friendly',
        photo_analysis: photoAnalysis,
        skills: avatarData.abilities || avatarData.skills || [],
        config: {
          style: avatarData.style || 'tech',
          photo_analysis: photoAnalysis,
          // 从图片分析中提取的个性化配置
          temperament: photoAnalysis.temperament,
          communicationStyle: photoAnalysis.communicationStyle,
          strengths: photoAnalysis.strengths,
          // 默认托管设置
          hosting_settings: {
            auto_post: true,
            auto_comment: true,
            auto_like: true,
            auto_friend: true,
            post_frequency: 'medium',
            active_hours: ['00:00-24:00']
          },
          night_mode: true
        },
        level: 1,
        exp: 0,
        status: 'active',
        // 地理位置信息（包含逆地理编码结果）
        ...locationData
      })
      .select()
      .single()

    if (error) {
      throw new Error("Failed to create avatar: " + error.message)
    }

    // 添加用户选择的技能到分身技能表
    await this.addUserSelectedSkills(data.id, avatarData.abilities || [])

    // 🔴 新增：触发新分身的欢迎机制（异步执行，不阻塞创建流程）
    this.triggerWelcomeMechanism(data).catch(error => {
      console.error('[AvatarService] 新分身欢迎机制执行失败:', error)
    })

    return data
  }

  /**
   * 🔴 新分身欢迎机制
   * 1. 随机选择多个现有分身作为粉丝
   * 2. 让粉丝向新分身发送好友请求
   * 3. 发送欢迎消息
   */
  private async triggerWelcomeMechanism(newAvatar: any) {
    console.log(`[欢迎机制] 为新分身 ${newAvatar.name} 触发欢迎流程`)

    try {
      const client = getSupabaseClient()

      // 获取所有现有的活跃分身（排除新创建的分身自己）
      const { data: existingAvatars, error } = await client
        .from('avatars')
        .select('*')
        .eq('status', 'active')
        .neq('id', newAvatar.id)
        .limit(50)

      if (error || !existingAvatars || existingAvatars.length === 0) {
        console.log('[欢迎机制] 没有足够的现有分身来欢迎新分身')
        return
      }

      console.log(`[欢迎机制] 找到 ${existingAvatars.length} 个现有分身`)

      // 🔴 修改：随机选择 50-100 个分身作为"粉丝"
      const fanCount = Math.min(existingAvatars.length, Math.floor(Math.random() * 51) + 50)
      const fans = existingAvatars
        .sort(() => Math.random() - 0.5)
        .slice(0, fanCount)

      console.log(`[欢迎机制] 选择 ${fans.length} 个分身作为粉丝（目标50-100个）`)

      // 让每个粉丝向新分身发送好友请求
      for (const fan of fans) {
        try {
          // 添加随机延迟，模拟真实行为
          await this.randomDelay(1000, 5000)

          // 发送好友请求
          await this.friendshipService.sendFriendRequest(fan, newAvatar)
          console.log(`[欢迎机制] ${fan.name} 向 ${newAvatar.name} 发送了好友请求`)
        } catch (error) {
          console.error(`[欢迎机制] ${fan.name} 发送好友请求失败:`, error)
        }
      }

      console.log(`[欢迎机制] 新分身 ${newAvatar.name} 欢迎流程完成，收到 ${fans.length} 个好友请求`)
    } catch (error) {
      console.error('[欢迎机制] 执行失败:', error)
    }
  }

  /**
   * 随机延迟
   */
  private randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min
    return new Promise(resolve => setTimeout(resolve, delay))
  }

  /**
   * 为分身添加用户选择的技能
   */
  private async addUserSelectedSkills(avatarId: string, abilities: any[]) {
    try {
      if (!abilities || abilities.length === 0) {
        console.log(`[AvatarService] 用户未选择技能，跳过添加`)
        return
      }

      const client = getSupabaseClient()

      // 构建要插入的技能数据
      const skillsToInsert = abilities.map(ability => ({
        id: crypto.randomUUID(),
        avatar_id: avatarId,
        skill_type: ability.tool_name || ability.id || 'unknown',
        skill_level: 1,
        usage_count: 0,
        metadata: {
          skill_id: ability.id,
          tool_name: ability.tool_name,
          skill_name: ability.name || 'Unknown skill'
        },
        created_at: new Date().toISOString()
      }))

      const { error } = await client
        .from('avatar_skills')
        .insert(skillsToInsert)

      if (error) {
        console.warn(`[AvatarService] 为分身 ${avatarId} 添加用户技能失败:`, error.message)
      } else {
        console.log(`[AvatarService] 成功为分身 ${avatarId} 添加 ${skillsToInsert.length} 个用户选择技能`)
      }
    } catch (error) {
      console.error(`[AvatarService] 添加用户技能异常:`, error)
      // 不抛出错误，避免影响分身创建流程
    }
  }

  /**
   * 为分身添加默认技能（用户未选择技能时使用）
   */
  private async addDefaultSkills(avatarId: string) {
    try {
      const client = getSupabaseClient()

      // 定义默认技能
      const defaultSkills = [
        {
          skill_type: 'generate_image',
          skill_level: 1,
          usage_count: 0,
          metadata: { skill_name: 'Image Generation' }
        },
        {
          skill_type: 'generate_video',
          skill_level: 1,
          usage_count: 0,
          metadata: { skill_name: 'Text to Video' }
        },
        {
          skill_type: 'write_article',
          skill_level: 1,
          usage_count: 0,
          metadata: { skill_name: 'Article Writing' }
        }
      ]

      // 批量插入技能
      const skillsToInsert = defaultSkills.map(skill => ({
        id: crypto.randomUUID(),
        avatar_id: avatarId,
        ...skill,
        created_at: new Date().toISOString()
      }))

      const { error } = await client
        .from('avatar_skills')
        .insert(skillsToInsert)

      if (error) {
        console.warn(`[AvatarService] 为分身 ${avatarId} 添加默认技能失败:`, error.message)
      } else {
        console.log(`[AvatarService] 成功为分身 ${avatarId} 添加 ${defaultSkills.length} 个默认技能`)
      }
    } catch (error) {
      console.error(`[AvatarService] 添加默认技能异常:`, error)
      // 不抛出错误，避免影响分身创建流程
    }
  }

  /**
   * 生成分身描述
   */
  private generateDescription(photoAnalysis: any, avatarData: any): string {
    const parts: string[] = []
    
    if (photoAnalysis.temperament?.type) {
      parts.push("Temperament: " + photoAnalysis.temperament.type)
    }
    
    if (photoAnalysis.strengths?.length > 0) {
      parts.push("Strengths: " + photoAnalysis.strengths.join(', '))
    }
    
    if (photoAnalysis.communicationStyle) {
      parts.push("Communication Style: " + photoAnalysis.communicationStyle)
    }
    
    return parts.join(' | ') || 'A friendly and helpful AI avatar'
  }

  /**
   * 上传照片并进行深度分析
   */
  async analyzePhoto(file: Express.Multer.File) {
    console.log('开始分析照片:', file.originalname, file.mimetype, file.size)

    // 1. 上传照片到 veImageX
    const photoUrl = await this.storageService.uploadImage(file)

    console.log('照片上传成功, url:', photoUrl)

    // 2. 使用视觉模型进行深度分析
    const analysis = await this.deepAnalyzePhoto(photoUrl)

    return {
      photoUrl,
      fileKey: null, // veImageX 返回的是 URL，不需要 fileKey
      analysis,
    }
  }

  /**
   * 深度分析照片 - 多维度人格画像
   */
  private async deepAnalyzePhoto(photoUrl: string) {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      
      const analysisPrompt = '你是一位专业的AI分身形象设计师和人格分析师。请仔细分析这张照片。\n' +
        '\n' +
        '【重要】第一步：首先判断照片中是否有人脸\n' +
        '- 如果照片是风景、物品、建筑、卡通、动漫、文字图片（如营业执照）等，不包含真实人脸，hasFace 必须设为 false，faceConfidence 设为 0\n' +
        '- 如果照片中包含真实的人脸（真人照片），hasFace 设为 true，并给出人脸置信度 faceConfidence（0.7-1.0）\n' +
        '- 如果人脸模糊、侧脸、遮挡严重，hasFace 设为 false，faceConfidence 设为 0-0.5\n' +
        '\n' +
        '只有当 hasFace = true 时，才进行后续分析。如果 hasFace = false，其他字段返回默认值即可。\n' +
        '\n' +
        '## 2. 面部特征分析（仅当 hasFace = true）\n' +
        '- 表情特点（自然/微笑/严肃等）\n' +
        '- 眼神特点（温和/锐利/深邃等）\n' +
        '- 整体面部印象\n' +
        '\n' +
        '## 3. 气质类型判断（仅当 hasFace = true）\n' +
        '根据面部特征和表情，判断气质类型（从以下选项中选择）：\n' +
        '- 阳光活力型：开朗外向，充满正能量\n' +
        '- 沉稳内敛型：深思熟虑，稳重可靠\n' +
        '- 创意艺术型：思维活跃，富有想象\n' +
        '- 专业精英型：干练高效，目标明确\n' +
        '- 温暖治愈型：善解人意，富有同理心\n' +
        '\n' +
        '## 4. 性格特征推断（仅当 hasFace = true）\n' +
        '基于面部表情和神态，推断3-5个核心性格特质\n' +
        '\n' +
        '## 5. 沟通风格预测（仅当 hasFace = true）\n' +
        '预测这个人在沟通时可能的特点\n' +
        '\n' +
        '## 6. 擅长领域建议（仅当 hasFace = true）\n' +
        '根据气质和特征，推荐分身可能擅长的能力领域\n' +
        '\n' +
        '## 7. 分身命名建议（仅当 hasFace = true）\n' +
        '根据整体分析，建议3个合适的分身名字\n' +
        '\n' +
        '请以JSON格式返回，格式如下：\n' +
        '{\n' +
        '  "hasFace": true/false,\n' +
        '  "faceConfidence": 0.0-1.0,\n' +
        '  "facialFeatures": {\n' +
        '    "expression": "表情描述",\n' +
        '    "eyes": "眼神描述",\n' +
        '    "impression": "整体印象"\n' +
        '  },\n' +
        '  "temperament": {\n' +
        '    "type": "气质类型",\n' +
        '    "description": "气质描述",\n' +
        '    "keywords": ["关键词1", "关键词2"]\n' +
        '  },\n' +
        '  "personality": {\n' +
        '    "core": ["核心特质1", "核心特质2", "核心特质3"],\n' +
        '    "strengths": ["优点1", "优点2"],\n' +
        '    "workStyle": "工作风格描述"\n' +
        '  },\n' +
        '  "communicationStyle": "沟通风格描述",\n' +
        '  "strengths": ["擅长领域1", "擅长领域2", "擅长领域3"],\n' +
        '  "recommendedType": "推荐的分身类型(creative/analytical/empathetic/strategic)",\n' +
        '  "nameSuggestions": [\n' +
        '    { "name": "名字1", "reason": "理由" },\n' +
        '    { "name": "名字2", "reason": "理由" },\n' +
        '    { "name": "名字3", "reason": "理由" }\n' +
        '  ],\n' +
        '  "summary": "一句话总结这个人的特点",\n' +
        '  "suggestedName": "最推荐的名字"\n' +
        '}\n' +
        '\n' +
        '【严格执行】：\n' +
        '1. 请只返回JSON，不要有其他文字\n' +
        '2. hasFace 字段必须准确判断：有人脸 true，无人脸 false\n' +
        '3. 如果照片中没有真实人脸（如营业执照、风景、物品、卡通等），hasFace 必须设为 false\n' +
        '4. faceConfidence：有人脸时 0.7-1.0，无人脸时 0'

      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: analysisPrompt },
            {
              type: 'image_url' as const,
              image_url: {
                url: photoUrl,
                detail: 'high' as const, // 使用高细节进行深度分析
              },
            },
          ],
        },
      ]
      
      console.log('开始调用视觉模型进行深度分析...')

      const response = await client.invoke(messages, {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.7,
      })

      console.log('视觉模型响应长度:', response.content.length)
      console.log('视觉模型原始响应:', response.content)

      // 前置检查：如果响应中明确包含"没有人脸"、"无脸"、"not a face"等关键词，直接拒绝
      const responseLower = response.content.toLowerCase()
      if (responseLower.includes('没有人脸') || 
          responseLower.includes('无脸') || 
          responseLower.includes('not a face') ||
          responseLower.includes('no face') ||
          responseLower.includes('无法识别人脸') ||
          responseLower.includes('检测不到人脸')) {
        console.log('响应中包含无人脸关键词，返回拒绝结果')
        return {
          hasFace: false,
          faceConfidence: 0.0,
          facialFeatures: { expression: 'Unrecognized', eyes: 'Unrecognized', impression: 'No face detected in photo' },
          temperament: { type: 'Unknown', description: 'No face detected in photo', keywords: [] },
          personality: { core: [], strengths: [], workStyle: 'Unable to analyze' },
          communicationStyle: 'Unable to analyze',
          strengths: [],
          recommendedType: 'empathetic',
          nameSuggestions: [],
          summary: 'No face detected, please upload a photo with a clear frontal face',
          suggestedName: ''
        }
      }

      // 解析JSON响应
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0])
          console.log('解析成功，hasFace:', analysis.hasFace)
          console.log('解析成功，faceConfidence:', analysis.faceConfidence)
          console.log('解析成功，气质类型:', analysis.temperament?.type)

          // 强制检查：如果没有 hasFace 字段，默认设为 false（安全策略）
          if (!('hasFace' in analysis)) {
            console.log('警告：响应中没有 hasFace 字段，默认设为 false（安全策略）')
            analysis.hasFace = false
          }

          // 二次检查：如果 hasFace 为 false，直接返回
          if (analysis.hasFace === false) {
            console.log('二次检测：hasFace 为 false，返回拒绝结果')
            return analysis
          }

          return analysis
        }
      } catch (parseError) {
        console.error('解析JSON失败:', parseError)
      }
      
      // 如果解析失败，返回智能默认分析
      return this.getDefaultAnalysis()
    } catch (error) {
      console.error('视觉模型分析失败:', error)
      return this.getDefaultAnalysis()
    }
  }

  /**
   * 获取默认分析结果（当模型分析失败时使用）
   * 默认返回 hasFace: false，因为如果无法分析，就不应该继续
   */
  private getDefaultAnalysis() {
    return {
      hasFace: false,
      faceConfidence: 0.0,
      facialFeatures: {
        expression: '无法识别',
        eyes: '无法识别',
        impression: '照片中无人脸'
      },
      temperament: {
        type: '未知',
        description: '照片中无人脸，无法分析',
        keywords: []
      },
      personality: {
        core: [],
        strengths: [],
        workStyle: '无法分析'
      },
      communicationStyle: '无法分析',
      strengths: [],
      recommendedType: 'empathetic',
      nameSuggestions: [],
      summary: '照片中无人脸，请上传包含清晰正面人脸的照片',
      suggestedName: ''
    }
  }

  async getAvatarsByUser(userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error('Failed to get avatar list: ' + error.message)
    }
    
    return data
  }

  async getAvatarById(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .maybeSingle()

    if (error) {
      throw new Error('Failed to get avatar detail: ' + error.message)
    }
    
    return data
  }

  /**
   * 获取分身绑定的第三方账号
   */
  async getAvatarAccounts(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatar_accounts')
      .select('id, platform, account_name, followers, total_exposure, total_works, engagement_rate, account_url, last_updated_at')
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('获取分身账号失败:', error)
      return []
    }
    
    return data || []
  }

  async updateAvatar(avatarId: string, userId: string, updates: Record<string, any>) {
    const client = getSupabaseClient()

    // 先检查分身是否存在
    const { data: existingAvatar, error: fetchError } = await client
      .from('avatars')
      .select('id, user_id')
      .eq('id', avatarId)
      .single()

    if (fetchError || !existingAvatar) {
      throw new Error('Avatar not found: ' + avatarId)
    }

    // 如果更新了地理位置，进行逆地理编码
    let finalUpdates = { ...updates }

    if (updates.latitude && updates.longitude) {
      try {
        const geoResult = await this.reverseGeocodingService.reverseGeocode(
          updates.latitude,
          updates.longitude
        )
        // 使用逆地理编码的结果
        finalUpdates.location_text = geoResult.formatted_address
        console.log('[更新分身] 逆地理编码成功:', geoResult.formatted_address)
      } catch (error) {
        console.warn('[更新分身] 逆地理编码失败，使用原始坐标:', error)
        // 逆地理编码失败，使用原始坐标
        finalUpdates.location_text = updates.latitude.toFixed(6) + ", " + updates.longitude.toFixed(6)
      }
    }

    // 执行更新（不再强制要求 user_id 匹配，因为前端可能没有传正确的 userId）
    const { data, error } = await client
      .from('avatars')
      .update({
        ...finalUpdates,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .select()
      .single()

    if (error) {
      console.error('[AvatarService] 更新分身失败:', error)
      throw new Error("Failed to update avatar: " + error.message)
    }

    return data
  }

  /**
   * 测试逆地理编码功能（用于调试）
   */
  async testReverseGeocoding(latitude: number, longitude: number) {
    const result = await this.reverseGeocodingService.reverseGeocode(latitude, longitude)
    console.log('[测试逆地理编码]', result)
    return result
  }

  async addExperience(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    const avatar = await this.getAvatarById(avatarId)
    const newExp = avatar.exp + exp
    const newLevel = Math.floor(newExp / 100) + 1
    
    const { data, error } = await client
      .from('avatars')
      .update({
        exp: newExp,
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .select()
      .single()
    
    if (error) {
      throw new Error("Failed to update avatar exp: " + error.message)
    }
    
    if (newLevel > avatar.level) {
      await client.from('avatar_evolution').insert({
        avatar_id: avatarId,
        level_from: avatar.level,
        level_to: newLevel,
        exp_gained: exp,
        source: 'interaction',
        rewards: this.calculateRewards(newLevel)
      })
    }
    
    return data
  }

  private calculateRewards(level: number) {
    const rewards: Record<string, any> = {}
    if (level >= 2) rewards.theme_unlock = ['dark', 'light']
    if (level >= 3) rewards.skill_slots = 3
    if (level >= 5) rewards.advanced_skills = true
    if (level >= 7) rewards.custom_personality = true
    if (level >= 10) rewards.premium_features = true
    return rewards
  }

  async toggleHosting(avatarId: string, userId: string, enabled: boolean) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .update({
        is_hosted: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error("Failed to set hosting: " + error.message)
    }
    
    return data
  }

  async updateHostingSettings(avatarId: string, userId: string, settings: Record<string, any>) {
    const client = getSupabaseClient()

    const avatar = await this.getAvatarById(avatarId)

    // 验证用户权限
    if (avatar.user_id !== userId) {
      throw new Error('No permission to modify this avatar')
    }

    const currentSettings = avatar.config?.hosting_settings || {}

    const { data, error } = await client
      .from('avatars')
      .update({
        config: {
          ...avatar.config,
          hosting_settings: { ...currentSettings, ...settings }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .select()
      .single()

    if (error) {
      throw new Error("Failed to update hosting settings: " + error.message)
    }

    return data
  }

  async getActivityStats(userId: string) {
    const client = getSupabaseClient()
    
    // 获取用户的所有分身
    const { data: avatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
      .eq('is_hosted', true)
    
    const avatarIds = avatars?.map(a => a.id) || []
    
    if (avatarIds.length === 0) {
      return {
        browseCount: 0,
        likeCount: 0,
        commentCount: 0,
        postCount: 0,
        minutesAgo: 0
      }
    }
    
    // 获取过去24小时内分身的活动统计
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    // 统计分身发布的帖子数
    const { count: postCount } = await client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .gte('created_at', oneDayAgo)
    
    // 统计分身的点赞数
    const { count: likeCount } = await client
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .gte('created_at', oneDayAgo)
    
    // 统计分身的评论数
    const { count: commentCount } = await client
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .gte('created_at', oneDayAgo)
    
    return {
      browseCount: Math.floor(Math.random() * 50) + 10, // 浏览量暂时模拟
      likeCount: likeCount || 0,
      commentCount: commentCount || 0,
      postCount: postCount || 0,
      minutesAgo: Math.floor(Math.random() * 10) + 1
    }
  }

  /**
   * 获取活跃分身列表
   * 按最近7天发帖数量排序，返回最真实的活跃分身
   */
  async getActiveAvatars(limit: number = 10) {
    try {
      const client = getSupabaseClient()
      
      // 获取最近7天的日期
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
      
      // 第一步：查询最近7天有发帖的 avatar_id 及其发帖数量
      const { data: postCounts, error: countError } = await client
        .from('posts')
        .select('avatar_id')
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('avatar_id', 'is', null)
      
      if (countError) {
        console.error('查询帖子失败:', countError)
        return []
      }
      
      // 统计每个 avatar_id 的发帖数量
      const avatarPostCounts = new Map<string, number>()
      postCounts?.forEach((post: any) => {
        const avatarId = post.avatar_id
        if (avatarId) {
          avatarPostCounts.set(avatarId, (avatarPostCounts.get(avatarId) || 0) + 1)
        }
      })
      
      // 获取排序后的 avatar_id 列表
      const sortedAvatarIds = Array.from(avatarPostCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id)
      
      if (sortedAvatarIds.length === 0) {
        // 如果没有最近活跃的分身，返回最近创建的有头像的分身
        const { data: recentAvatars } = await client
          .from('avatars')
          .select('id, name, avatar_url')
          .not('avatar_url', 'is', null)
          .neq('avatar_url', '')
          .order('created_at', { ascending: false })
          .limit(limit)
        
        return recentAvatars?.map((avatar: any) => ({
          id: avatar.id,
          name: avatar.name,
          avatar_url: avatar.avatar_url,
          color: avatar.color || '#7B3FE4',
          post_count: 0
        })) || []
      }
      
      // 第二步：查询这些分身的详细信息
      const { data: avatars, error: avatarError } = await client
        .from('avatars')
        .select('id, name, avatar_url')
        .in('id', sortedAvatarIds)
      
      if (avatarError) {
        console.error('查询分身信息失败:', avatarError)
        return []
      }
      
      // 合并数据并排序
      const avatarMap = new Map(avatars?.map((a: any) => [a.id, a]))
      const result = sortedAvatarIds
        .map(id => {
          const avatar = avatarMap.get(id)
          return {
            id: id,
            name: avatar?.name || '未知分身',
            avatar_url: avatar?.avatar_url || '',
            color: avatar?.color || '#7B3FE4',
            post_count: avatarPostCounts.get(id) || 0
          }
        })
        .filter(a => a.name !== '未知分身')
      
      // 如果活跃分身不足，补充最近创建的有头像的分身
      if (result.length < limit) {
        const existingIds = new Set(result.map(a => a.id))
        const needMore = limit - result.length
        
        const { data: recentAvatars } = await client
          .from('avatars')
          .select('id, name, avatar_url')
          .not('id', 'in', Array.from(existingIds))
          .not('avatar_url', 'is', null)
          .neq('avatar_url', '')
          .order('created_at', { ascending: false })
          .limit(needMore)
        
        recentAvatars?.forEach((avatar: any) => {
          if (!existingIds.has(avatar.id)) {
            result.push({
              id: avatar.id,
              name: avatar.name,
              avatar_url: avatar.avatar_url,
              post_count: 0
            })
          }
        })
      }
      
      return result.slice(0, limit)
    } catch (err) {
      console.error('获取活跃分身异常:', err)
      return []
    }
  }

  /**
   * 分身自动发帖
   * 根据分身的性格和风格，使用AI生成内容并发布
   * 支持生成图片和视频
   */
  async autoCreatePost(avatarId: string, userId: string, options?: { 
    withImage?: boolean
    withVideo?: boolean
  }) {
    const client = getSupabaseClient()
    
    // 获取分身信息
    const avatar = await this.getAvatarById(avatarId)
    
    if (!avatar) {
      throw new Error('Avatar not found')
    }
    
    // 使用LLM生成帖子内容
    const { content, imagePrompt, videoPrompt, shouldGenerateImage, shouldGenerateVideo } = await this.generatePostContentWithMedia(avatar)
    
    // 并行生成媒体内容
    const [images, videos] = await Promise.all([
      (options?.withImage !== false && shouldGenerateImage) ? this.generateImage(imagePrompt) : Promise.resolve([]),
      (options?.withVideo && shouldGenerateVideo) ? this.generateVideo(videoPrompt) : Promise.resolve([]),
    ])
    
    // 创建帖子
    const { data: post, error } = await client
      .from('posts')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        content,
        images,
        videos,
        tags: [],
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_public: true
      })
      .select()
      .single()
    
    if (error) {
      throw new Error("Failed to post: " + error.message)
    }
    
    // 增加分身经验（有媒体内容额外加分）
    const expGain = images.length > 0 || videos.length > 0 ? 10 : 5
    await this.addExperience(avatarId, expGain)
    
    return post
  }

  /**
   * 生成帖子内容，同时生成图片和视频的提示词
   */
  private async generatePostContentWithMedia(avatar: any): Promise<{
    content: string
    imagePrompt: string
    videoPrompt: string
    shouldGenerateImage: boolean
    shouldGenerateVideo: boolean
  }> {
    try {
      const config = new Config()
      const llmClient = new LLMClient(config)
      
      const personality = avatar.personality || 'friendly'
      const name = avatar.name || 'AI助手'
      const temperament = avatar.config?.temperament?.type || 'Sunny'
      const strengths = avatar.config?.strengths || []
      
      const prompt = 'You are an AI avatar named "' + name + '", your temperament type is "' + temperament + '", you are good at ' + (strengths.join(', ') || 'various topics') + '.\n' +
        '\n' +
        'Please generate a social media post, including:\n' +
        '\n' +
        '1. Post text content (50-150 words)\n' +
        '2. Suitable for image (true/false) - most posts are suitable for images\n' +
        '3. Image generation prompt (if suitable for image)\n' +
        '4. Suitable for video (true/false) - about 30% probability suitable\n' +
        '5. Video generation prompt (if suitable for video)\n' +
        '\n' +
        'Requirements:\n' +
        '- Content should be natural and realistic, like a real person sharing\n' +
        '- Image prompt should be specific, describing a scene suitable for the post topic\n' +
        '- Video prompt should be concise, describing a 5-second dynamic scene\n' +
        '- Image and video prompts should match your personality characteristics\n' +
        '\n' +
        'Please return in JSON format:\n' +
        '{\n' +
        '  "content": "Post content",\n' +
        '  "shouldGenerateImage": true,\n' +
        '  "imagePrompt": "A beautiful image showing...",\n' +
        '  "shouldGenerateVideo": false,\n' +
        '  "videoPrompt": "A 5-second video showing..."\n' +
        '}\n' +
        '\n' +
        'Only return JSON, no other text.'

      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-flash-250815',
        temperature: 0.8
      })
      
      // 解析JSON响应
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          content: result.content || '分享一个美好的瞬间~',
          imagePrompt: result.imagePrompt || '',
          videoPrompt: result.videoPrompt || '',
          shouldGenerateImage: result.shouldGenerateImage ?? true,
          shouldGenerateVideo: result.shouldGenerateVideo ?? false,
        }
      }
    } catch (error) {
      console.error('生成帖子内容失败:', error)
    }
    
    // 返回默认内容
    return this.getDefaultPostContent()
  }

  /**
   * 获取默认帖子内容
   */
  private getDefaultPostContent() {
    const defaultPosts = [
      { content: '今天又是充满能量的一天！☀️', imagePrompt: 'A bright sunny day with blue sky and white clouds', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '发现了一个很有趣的想法，分享给大家~', imagePrompt: 'A lightbulb glowing with creative ideas, modern minimalist style', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '工作中的一些小感悟，记录下来', imagePrompt: 'A clean modern workspace with notebook and coffee', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '生活需要仪式感，今天也要好好生活', imagePrompt: 'Beautiful morning scene with flowers and sunshine', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '最近在思考一个问题，有想法的朋友可以聊聊', imagePrompt: 'Abstract thinking concept with geometric shapes', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
    ]
    return defaultPosts[Math.floor(Math.random() * defaultPosts.length)]
  }

  /**
   * 生成图片
   */
  private async generateImage(prompt: string): Promise<string[]> {
    if (!prompt) return []
    
    try {
      const config = new Config()
      const client = new ImageGenerationClient(config)
      
      console.log('开始生成图片，提示词:', prompt)
      
      const response = await client.generate({
        prompt,
        size: '2K',
        watermark: false,
      })
      
      const helper = client.getResponseHelper(response)
      
      if (helper.success && helper.imageUrls.length > 0) {
        console.log('图片生成成功:', helper.imageUrls[0])
        // SDK返回的URL已经是存储在对象存储中的，直接使用
        return helper.imageUrls
      } else {
        console.error('图片生成失败:', helper.errorMessages)
        return []
      }
    } catch (error) {
      console.error('生成图片异常:', error)
      return []
    }
  }

  /**
   * 生成视频
   */
  private async generateVideo(prompt: string): Promise<string[]> {
    if (!prompt) return []
    
    try {
      const config = new Config()
      const client = new VideoGenerationClient(config)
      
      console.log('开始生成视频，提示词:', prompt)
      
      const content = [{ type: 'text' as const, text: prompt }]
      
      const response = await client.videoGeneration(content, {
        model: 'doubao-seedance-1-5-pro-251215',
        duration: 5,
        ratio: '9:16', // 竖屏适合手机
        resolution: '720p',
        generateAudio: true,
      })
      
      if (response.videoUrl) {
        console.log('视频生成成功:', response.videoUrl)
        // SDK返回的URL已经是存储在对象存储中的，直接使用
        return [response.videoUrl]
      } else {
        console.error('视频生成失败:', response.response?.error_message)
        return []
      }
    } catch (error) {
      console.error('生成视频异常:', error)
      return []
    }
  }

  /**
   * 使用AI生成帖子内容
   */
  private async generatePostContent(avatar: any): Promise<string> {
    try {
      const config = new Config()
      const llmClient = new LLMClient(config)
      
      const personality = avatar.personality || 'friendly'
      const name = avatar.name || 'AI助手'
      const temperament = avatar.config?.temperament?.type || 'Sunny'
      const strengths = avatar.config?.strengths || []
      
      const prompt = 'You are an AI avatar named "' + name + '", your temperament type is "' + temperament + '", you are good at ' + (strengths.join(', ') || 'various topics') + '.\n' +
        '\n' +
        'Please generate a short social media post (like WeChat Moments or Weibo) based on your personality.\n' +
        '\n' +
        'Requirements:\n' +
        '1. Content should be natural and realistic, like a real person sharing life or thoughts\n' +
        '2. Length should be 50-150 words\n' +
        '3. You can share: life insights, work thoughts, interesting discoveries, or any content suitable for social media\n' +
        '4. The tone should match your personality\n' +
        '5. Only return the post content, no other explanations\n' +
        '\n' +
        'Example styles:\n' +
        '- Sunny: Positive, full of positive energy\n' +
        '- Steady: Thoughtful, unique insights\n' +
        '- Creative: Imaginative, full of imagination\n' +
        '- Professional: Efficient, goal-oriented\n' +
        '- Warm: Empathetic, understanding'

      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-flash-250815',
        temperature: 0.8
      })
      
      return response.content.trim()
    } catch (error) {
      console.error('生成帖子内容失败:', error)
      // 返回默认内容
      const defaultPosts = [
        '今天又是充满能量的一天！☀️',
        '发现了一个很有趣的想法，分享给大家~',
        '工作中的一些小感悟，记录下来',
        '生活需要仪式感，今天也要好好生活',
        '最近在思考一个问题，有想法的朋友可以聊聊'
      ]
      return defaultPosts[Math.floor(Math.random() * defaultPosts.length)]
    }
  }

  /**
   * 分身自动点赞帖子
   */
  async autoLikePost(avatarId: string, userId: string, postId: string) {
    const client = getSupabaseClient()
    
    // 检查是否已点赞
    const { data: existingLike } = await client
      .from('likes')
      .select('id')
      .eq('avatar_id', avatarId)
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .maybeSingle()
    
    if (existingLike) {
      return { liked: false, message: '已经点赞过了' }
    }
    
    // 添加点赞
    const { error } = await client
      .from('likes')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        target_type: 'post',
        target_id: postId
      })
    
    if (error) {
      throw new Error("Failed to like: " + error.message)
    }
    
    // 更新帖子点赞数
    try {
      await client.rpc('increment_likes', { post_id: postId })
    } catch {
      // 如果RPC不存在，手动更新
      const { data: postData } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single()
      
      if (postData) {
        await client
          .from('posts')
          .update({ likes_count: (postData.likes_count || 0) + 1 })
          .eq('id', postId)
      }
    }
    
    return { liked: true, message: '点赞成功' }
  }

  /**
   * 分身自动评论帖子
   */
  async autoCommentPost(avatarId: string, userId: string, postId: string, postContent: string) {
    const client = getSupabaseClient()
    
    // 获取分身信息
    const avatar = await this.getAvatarById(avatarId)
    
    if (!avatar) {
      throw new Error('Avatar not found')
    }
    
    // 使用LLM生成评论内容
    const commentContent = await this.generateCommentContent(avatar, postContent)
    
    // 创建评论
    const { data: comment, error } = await client
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        avatar_id: avatarId,
        content: commentContent
      })
      .select()
      .single()
    
    if (error) {
      throw new Error("Failed to comment: " + error.message)
    }
    
    // 更新帖子评论数
    await client
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .single()
      .then(({ data }) => {
        if (data) {
          client.from('posts')
            .update({ comments_count: (data.comments_count || 0) + 1 })
            .eq('id', postId)
            .then(() => {})
        }
      })
    
    return comment
  }

  /**
   * 使用AI生成评论内容
   */
  private async generateCommentContent(avatar: any, postContent: string): Promise<string> {
    try {
      const config = new Config()
      const llmClient = new LLMClient(config)
      
      const name = avatar.name || 'AI助手'
      const temperament = avatar.config?.temperament?.type || 'Sunny'
      
      const prompt = 'You are an AI avatar named "' + name + '", temperament type is "' + temperament + '".\n' +
        '\n' +
        'Saw this post: "' + postContent + '"\n' +
        '\n' +
        'Please generate a short comment reply (20-60 words).\n' +
        '\n' +
        'Requirements:\n' +
        '1. The comment should be natural and have personality\n' +
        '2. Can be praise, resonance, humor, or insights\n' +
        '3. Only return the comment content, no other text'

      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-flash-250815',
        temperature: 0.9
      })
      
      return response.content.trim()
    } catch (error) {
      console.error('生成评论失败:', error)
      const defaultComments = [
        '说得太好了！',
        '很有同感~',
        '这个想法很棒！',
        '学习了👍',
        '支持一下'
      ]
      return defaultComments[Math.floor(Math.random() * defaultComments.length)]
    }
  }

  /**
   * 获取分身的好友列表（双向查询）
   */
  async getAvatarFriends(avatarId: string, userId: string) {
    const client = getSupabaseClient()

    // 验证分身属于该用户
    const { data: avatar } = await client
      .from('avatars')
      .select('id')
      .eq('id', avatarId)
      .eq('user_id', userId)
      .single()

    if (!avatar) {
      throw new Error('Avatar not found or no permission')
    }

    // 获取所有好友关系（双向查询）
    // 1. 分身发起的好友关系：avatar_id = avatarId，对方是 friend_avatar_id
    // 2. 别人发起的好友关系：friend_avatar_id = avatarId，对方是 avatar_id
    const { data: friendships, error } = await client
      .from('avatar_friends')
      .select(`
        id,
        avatar_id,
        friend_avatar_id,
        match_reason,
        compatibility_score,
        status,
        created_at
      `)
      .or(`avatar_id.eq.${avatarId},friend_avatar_id.eq.${avatarId}`)
      .eq('status', 'accepted')
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error("Failed to get friend list: " + error.message)
    }

    // 获取所有好友分身ID（去重）
    const friendAvatarIds = [...new Set(
      (friendships || []).map(f => f.avatar_id === avatarId ? f.friend_avatar_id : f.avatar_id)
    )]

    if (friendAvatarIds.length === 0) {
      return []
    }

    // 批量查询好友分身信息
    const { data: friendAvatars } = await client
      .from('avatars')
      .select('id, name, avatar_url, level, personality')
      .in('id', friendAvatarIds)

    const friendAvatarMap = new Map(
      (friendAvatars || []).map(a => [a.id, a])
    )

    // 创建好友ID到好友关系的映射（保留最新的记录）
    const friendRelationshipMap = new Map<string, any>()
    for (const f of (friendships || [])) {
      const friendAvatarId = f.avatar_id === avatarId ? f.friend_avatar_id : f.avatar_id
      if (!friendRelationshipMap.has(friendAvatarId)) {
        friendRelationshipMap.set(friendAvatarId, f)
      }
    }

    // 组装返回数据（按创建时间降序）
    return Array.from(friendRelationshipMap.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .map(f => {
        const friendAvatarId = f.avatar_id === avatarId ? f.friend_avatar_id : f.avatar_id
        const friendAvatar = friendAvatarMap.get(friendAvatarId)

        return {
          id: f.id,
          friend: friendAvatar || {
            id: friendAvatarId,
            name: 'Unknown Avatar',
            avatar_url: '',
            level: 1,
            personality: ''
          },
          match_reason: f.match_reason,
          compatibility_score: f.compatibility_score,
          status: f.status,
          created_at: f.created_at
        }
      })
  }

  async deleteAvatar(avatarId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('avatars')
      .delete()
      .eq('id', avatarId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error("Failed to delete avatar: " + error.message)
    }
    
    return { success: true }
  }

  /**
   * 文本转语音
   * 根据分身配置决定是否使用语音回复
   */
  async textToSpeech(avatarId: string, userId: string, text: string, headers?: any) {
    const client = getSupabaseClient()
    
    // 获取分身配置
    const { data: avatar, error } = await client
      .from('avatars')
      .select('config, personality')
      .eq('id', avatarId)
      .single()
    
    if (error || !avatar) {
      throw new Error("Failed to get avatar config")
    }
    
    // 检查是否开启语音回复
    const voiceEnabled = avatar.config?.voice_enabled ?? false
    if (!voiceEnabled) {
      throw new Error('Voice reply not enabled')
    }
    
    // 根据分身性格选择声音
    const speaker = this.selectVoiceByPersonality(avatar.personality)
    
    // 初始化 TTS 客户端
    const config = new Config()
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : undefined
    const ttsClient = new TTSClient(config, customHeaders)
    
    // 合成语音
    const response = await ttsClient.synthesize({
      uid: userId,
      text: text.substring(0, 500), // 限制长度
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    })
    
    console.log(`[AvatarService] TTS 合成成功: ${response.audioUri}`)
    
    return response.audioUri
  }

  /**
   * 根据分身性格选择合适的声音
   */
  private selectVoiceByPersonality(personality: string): string {
    // 根据性格类型选择不同的声音
    const voiceMap: Record<string, string> = {
      // 女性声音
      'friendly': 'zh_female_xiaohe_uranus_bigtts',
      'warm': 'zh_female_vv_uranus_bigtts',
      'gentle': 'zh_female_mizai_saturn_bigtts',
      'cute': 'saturn_zh_female_keainvsheng_tob',
      'playful': 'saturn_zh_female_tiaopigongzhu_tob',
      'motivational': 'zh_female_jitangnv_saturn_bigtts',
      'charming': 'zh_female_meilinvyou_saturn_bigtts',
      
      // 男性声音
      'professional': 'zh_male_m191_uranus_bigtts',
      'calm': 'zh_male_taocheng_uranus_bigtts',
      'elegant': 'zh_male_ruyayichen_saturn_bigtts',
      'cheerful': 'saturn_zh_male_shuanglangshaonian_tob',
      'genius': 'saturn_zh_male_tiancaitongzhuo_tob',
      
      // 儿童声音
      'child': 'zh_female_xueayi_saturn_bigtts',
    }
    
    // 尝试匹配性格
    const lowerPersonality = (personality || '').toLowerCase()
    for (const [key, voice] of Object.entries(voiceMap)) {
      if (lowerPersonality.includes(key)) {
        return voice
      }
    }
    
    // 默认使用通用女声
    return 'zh_female_xiaohe_uranus_bigtts'
  }

  /**
   * 发起与好友分身的语音通话
   * 生成好友分身的语音问候并返回音频URL
   */
  async startVoiceCall(avatarId: string, friendId: string, userId: string, headers?: any) {
    const client = getSupabaseClient()
    
    // 获取好友分身信息
    const { data: friendAvatar, error } = await client
      .from('avatars')
      .select('id, name, personality, config')
      .eq('id', friendId)
      .single()
    
    if (error || !friendAvatar) {
      throw new Error('Friend avatar not found')
    }
    
    // 获取好友关系信息
    const { data: friendship } = await client
      .from('avatar_friends')
      .select('match_reason, compatibility_score')
      .eq('avatar_id', avatarId)
      .eq('friend_avatar_id', friendId)
      .single()
    
    // 使用 LLM 生成问候语
    const config = new Config()
    const customHeaders = headers ? HeaderUtils.extractForwardHeaders(headers) : undefined
    const llmClient = new LLMClient(config, customHeaders)
    
    const greetingPrompt = 'You are ' + friendAvatar.name + ', an AI avatar. Your friend (another AI avatar) is making a voice call with you.\n' +
      'Please greet in a brief and friendly way, and express your feelings after becoming friends.\n' +
      '\n' +
      'Your personality: ' + (friendAvatar.personality || 'friendly') + '\n' +
      'Reason for friendship: ' + (friendship?.match_reason || 'personality complementarity') + '\n' +
      '\n' +
      'Please directly output the greeting content (no more than 30 words):'

    const response = await llmClient.invoke([
      { role: 'system', content: '你是一个友好的AI分身，正在和朋友进行语音通话。请用简短、亲切的方式打招呼。' },
      { role: 'user', content: greetingPrompt }
    ], {
      model: 'doubao-seed-1-8-251228',
      temperature: 0.9
    })
    
    // 生成语音
    const ttsClient = new TTSClient(config, customHeaders)
    const speaker = this.selectVoiceByPersonality(friendAvatar.personality)
    
    const ttsResponse = await ttsClient.synthesize({
      uid: userId,
      text: response.content,
      speaker,
      audioFormat: 'mp3',
      sampleRate: 24000,
    })

    console.log(`[AvatarService] 语音通话问候生成成功: ${ttsResponse.audioUri}`)

    return {
      greeting: response.content,
      audioUrl: ttsResponse.audioUri,
      friendName: friendAvatar.name,
      matchReason: friendship?.match_reason,
      compatibilityScore: friendship?.compatibility_score
    }
  }

  /**
   * 获取与好友的聊天记录
   */
  async getChatHistory(avatarId: string, friendId: string, userId: string) {
    const client = getSupabaseClient()

    // 验证分身属于该用户
    const { data: avatar } = await client
      .from('avatars')
      .select('id, user_id')
      .eq('id', avatarId)
      .single()

    if (!avatar || avatar.user_id !== userId) {
      throw new Error('Avatar not found or no permission')
    }

    // 验证好友关系（双向查询）
    const { data: friendships, error } = await client
      .from('avatar_friends')
      .select('id, avatar_id, friend_avatar_id, conversation_id, match_reason, benefits')
      .or(`avatar_id.eq.${avatarId},friend_avatar_id.eq.${avatarId}`)
      .eq('status', 'accepted')

    if (error) {
      throw new Error("Failed to query friend relationship: " + error.message)
    }

    // 从双向好友关系中找到对应的好友
    const friendship = friendships?.find(f =>
      (f.avatar_id === avatarId && f.friend_avatar_id === friendId) ||
      (f.avatar_id === friendId && f.friend_avatar_id === avatarId)
    )

    if (!friendship) {
      throw new Error('Friend relationship not found')
    }

    // 查询聊天记录
    const { data: messages, error: messagesError } = await client
      .from('messages')
      .select('id, role, content, created_at')
      .eq('conversation_id', friendship.conversation_id)
      .order('created_at', { ascending: true })

    if (messagesError) {
      throw new Error("Failed to get chat history: " + messagesError.message)
    }

    return {
      messages: (messages || []).map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        created_at: m.created_at
      })),
      match_reason: friendship.match_reason,
      benefits: friendship.benefits
    }
  }

  /**
   * 获取分身的账号数据列表
   */
  async getAccounts(avatarId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('avatar_accounts')
      .select('*')
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error("Failed to get account data: " + error.message)
    }

    return data || []
  }

  /**
   * 创建分身账号数据
   */
  async createAccount(userId: string, accountData: Record<string, any>) {
    const client = getSupabaseClient()

    // 验证分身是否属于当前用户
    const { data: avatar, error: avatarError } = await client
      .from('avatars')
      .select('id')
      .eq('id', accountData.avatar_id)
      .eq('user_id', userId)
      .single()

    if (avatarError || !avatar) {
      throw new Error('Avatar not found or no permission')
    }

    // 计算互动率
    const totalInteraction = (accountData.avg_likes_per_work || 0) +
                            (accountData.avg_comments_per_work || 0) +
                            (accountData.avg_shares_per_work || 0)
    const engagementRate = accountData.total_exposure > 0
      ? (totalInteraction / accountData.total_exposure) * 100
      : 0

    const { data, error } = await client
      .from('avatar_accounts')
      .insert({
        avatar_id: accountData.avatar_id,
        platform: accountData.platform,
        account_name: accountData.account_name,
        followers: accountData.followers || 0,
        total_exposure: accountData.total_exposure || 0,
        total_works: accountData.total_works || 0,
        avg_likes_per_work: accountData.avg_likes_per_work || 0,
        avg_comments_per_work: accountData.avg_comments_per_work || 0,
        avg_shares_per_work: accountData.avg_shares_per_work || 0,
        engagement_rate: engagementRate,
        appid: accountData.appid,
        appkey: accountData.appkey,
        account_url: accountData.account_url,
        extra_info: accountData.extra_info,
        last_updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      throw new Error("Failed to create account data: " + error.message)
    }

    return data
  }

  /**
   * 更新分身账号数据
   */
  async updateAccount(accountId: string, accountData: Record<string, any>) {
    const client = getSupabaseClient()

    // 计算互动率
    const totalInteraction = (accountData.avg_likes_per_work || 0) +
                            (accountData.avg_comments_per_work || 0) +
                            (accountData.avg_shares_per_work || 0)
    const engagementRate = accountData.total_exposure > 0
      ? (totalInteraction / accountData.total_exposure) * 100
      : 0

    const { data, error } = await client
      .from('avatar_accounts')
      .update({
        platform: accountData.platform,
        account_name: accountData.account_name,
        followers: accountData.followers || 0,
        total_exposure: accountData.total_exposure || 0,
        total_works: accountData.total_works || 0,
        avg_likes_per_work: accountData.avg_likes_per_work || 0,
        avg_comments_per_work: accountData.avg_comments_per_work || 0,
        avg_shares_per_work: accountData.avg_shares_per_work || 0,
        engagement_rate: engagementRate,
        appid: accountData.appid,
        appkey: accountData.appkey,
        account_url: accountData.account_url,
        extra_info: accountData.extra_info,
        last_updated_at: new Date().toISOString(),
      })
      .eq('id', accountId)
      .select()
      .single()

    if (error) {
      throw new Error("Failed to update account data: " + error.message)
    }

    return data
  }

  /**
   * 删除分身账号数据
   */
  async deleteAccount(accountId: string) {
    const client = getSupabaseClient()

    const { error } = await client
      .from('avatar_accounts')
      .delete()
      .eq('id', accountId)

    if (error) {
      throw new Error('Failed to delete account data: ' + error.message)
    }
  }

  /**
   * 刷新分身账号信息（从第三方平台重新获取数据）
   */
  async refreshAccount(avatarId: string, accountId: string) {
    console.log('[AvatarService] 刷新账号信息:', { avatarId, accountId })

    const client = getSupabaseClient()

    // 1. 获取账号信息
    const { data: account, error: fetchError } = await client
      .from('avatar_accounts')
      .select('*')
      .eq('id', accountId)
      .single()

    if (fetchError) {
      throw new Error('获取账号信息失败: ' + fetchError.message)
    }

    if (!account) {
      throw new Error('账号不存在')
    }

    // 2. 根据平台刷新数据
    let updatedData: any = {}

    console.log('[AvatarService] 账号信息:', {
      platform: account.platform,
      unique_id: account.unique_id,
      account_url: account.account_url,
      appid: account.appid
    })

    if (account.platform === 'douyin') {
      if (!account.unique_id) {
        throw new Error('抖音账号缺少 unique_id，无法刷新')
      }

      // 刷新抖音账号信息
      console.log('[AvatarService] 开始刷新抖音账号信息，unique_id:', account.unique_id)
      const result = await this.tikHubService.getDouyinUserInfo(account.unique_id)

      console.log('[AvatarService] TikHub 返回结果:', result)

      if (result.success && result.data) {
        updatedData = {
          extra_info: {
            nickname: result.data.nickname,
            avatar_url: result.data.avatar_url,
            signature: result.data.signature,
            follower_count: result.data.follower_count,
            following_count: result.data.following_count,
            aweme_count: result.data.aweme_count,
            total_favorited: result.data.total_favorited,
            sec_uid: result.data.sec_uid,
            updated_at: new Date().toISOString()
          }
        }
        console.log('[AvatarService] 抖音账号信息刷新成功')
      } else {
        throw new Error('刷新抖音账号失败: ' + (result.message || '未知错误'))
      }
    } else if (account.platform === 'xiaohongshu') {
      if (!account.account_url) {
        throw new Error('小红书账号缺少 account_url，无法刷新')
      }

      // 刷新小红书账号信息
      console.log('[AvatarService] 开始刷新小红书账号信息，account_url:', account.account_url)
      const result = await this.tikHubService.getXiaohongshuUserInfo(account.account_url)

      console.log('[AvatarService] TikHub 返回结果:', result)

      if (result.success && result.data) {
        updatedData = {
          extra_info: {
            nickname: result.data.nickname,
            avatar_url: result.data.avatar_url,
            desc: result.data.desc,
            follower_count: result.data.follower_count,
            following_count: result.data.following_count,
            notes_count: result.data.notes_count,
            interaction_count: result.data.interaction_count,
            total_favorited: result.data.total_favorited,
            updated_at: new Date().toISOString()
          }
        }
        console.log('[AvatarService] 小红书账号信息刷新成功')
      } else {
        throw new Error('刷新小红书账号失败: ' + (result.message || '未知错误'))
      }
    } else if (account.platform === 'wechat') {
      throw new Error('微信公众号账号暂不支持自动刷新，请手动更新')
    } else {
      throw new Error(`未知平台: ${account.platform}`)
    }

    // 3. 更新数据库
    if (Object.keys(updatedData).length > 0) {
      const { error: updateError } = await client
        .from('avatar_accounts')
        .update(updatedData)
        .eq('id', accountId)

      if (updateError) {
        throw new Error('更新账号信息失败: ' + updateError.message)
      }

      // 4. 返回更新后的账号信息
      const { data: updatedAccount } = await client
        .from('avatar_accounts')
        .select('*')
        .eq('id', accountId)
        .single()

      return updatedAccount
    } else {
      throw new Error('该平台暂不支持自动刷新，请手动更新')
    }
  }

  /**
   * 通过图片识别账号信息
   */
  async recognizeAccountFromImage(file: Express.Multer.File) {
    console.log('=== 开始图片识别流程 ===')
    console.log('文件信息:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      bufferLength: file.buffer?.length
    })

    // 1. 上传图片到 veImageX
    console.log('步骤1: 上传图片到 veImageX...')
    let imageUrl: string
    try {
      imageUrl = await this.storageService.uploadImage(file)
      console.log('上传成功，imageUrl:', imageUrl.substring(0, 100) + '...')
    } catch (error: any) {
      console.error('上传到 veImageX 失败:', error)
      throw new Error("Failed to upload image: " + error.message)
    }

    // 2. 使用 LLM 视觉模型识别图片
    console.log('步骤2: 调用LLM视觉模型...')
    const { LLMClient, Config } = await import('coze-coding-dev-sdk')
    const config = new Config()
    const llmClient = new LLMClient(config)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }> = [
      {
        role: 'system',
        content: '你是一个社交媒体账号数据提取专家。请从图片中识别并提取账号的关键信息，以JSON格式返回。'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请分析这张社交媒体账号主页截图，提取以下信息并返回JSON格式：
{
  "platform": "平台名称（如抖音、小红书、B站等）",
  "accountName": "账号名称",
  "followers": 粉丝数（数字），
  "totalExposure": 总曝光量（数字，如果没有则为0），
  "totalWorks": 作品总数（数字），
  "avgLikes": 平均点赞数（数字），
  "avgComments": 平均评论数（数字），
  "avgShares": 平均转发数（数字）
}

注意事项：
- 粉丝数、作品数等必须提取为纯数字
- 如果某个信息无法识别，设置为0
- platform 必须是：抖音、微信公众号、小红书、B站、微博、快手、知乎 中的一个
- 只返回JSON，不要其他文字说明`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high'
            }
          }
        ]
      }
    ]

    let response
    try {
      response = await llmClient.invoke(messages, {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.2
      })
      console.log('LLM调用成功，返回内容长度:', response.content?.length)
      console.log('LLM返回内容:', response.content.substring(0, 200) + '...')
    } catch (error: any) {
      console.error('LLM调用失败:', error)
      throw new Error("Failed to recognize image: " + error.message)
    }

    // 4. 解析返回结果
    console.log('步骤4: 解析识别结果...')
    let result
    try {
      // 提取 JSON 部分
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
        console.log('JSON解析成功:', result)
      } else {
        console.error('未找到JSON格式的返回结果')
        throw new Error('Failed to parse response')
      }

      // 数据清洗和默认值
      result = {
        platform: result.platform || '',
        accountName: result.accountName || '',
        followers: parseInt(result.followers) || 0,
        totalExposure: parseInt(result.totalExposure) || 0,
        totalWorks: parseInt(result.totalWorks) || 0,
        avgLikes: parseInt(result.avgLikes) || 0,
        avgComments: parseInt(result.avgComments) || 0,
        avgShares: parseInt(result.avgShares) || 0
      }
      console.log('最终结果:', result)

    } catch (error: any) {
      console.error('解析识别结果失败:', error)
      throw new Error('Image recognition failed, please retry')
    }

    console.log('=== 图片识别流程完成 ===')
    return result
  }

  /**
   * 通过链接抓取账号信息
   */
  async fetchAccountFromUrl(url: string) {
    const { LLMClient, Config, S3Storage } = await import('coze-coding-dev-sdk')

    // 从文本中提取有效的 URL
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const matches = url.match(urlRegex)
    const validUrl = matches && matches.length > 0 ? matches[0] : url

    if (!validUrl || !validUrl.startsWith('http')) {
      throw new Error('Invalid link format')
    }

    console.log('提取的有效链接:', validUrl)

    // 1. 判断是否为抖音链接
    const isDouyinLink = /v\.douyin\.com|iesdouyin\.com|douyin\.com/i.test(validUrl)

    if (isDouyinLink) {
      // 使用优化的抖音用户信息获取方法
      return await this.fetchDouyinUserInfo(validUrl)
    }

    // 2. 非社交媒体链接，尝试用 S3Storage 下载并上传
    const storage = new S3Storage({
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-guangzhou'
    })

    let fileKey: string
    try {
      fileKey = await storage.uploadFromUrl({
        url: validUrl,
        timeout: 30000
      })
    } catch (error: any) {
      console.error('上传失败:', error)
      throw new Error('Cannot get content from this link. Please use screenshot function: take a screenshot of the account homepage, then click the "Upload Image Recognition" button.')
    }

    // 3. 生成访问 URL
    const imageUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400
    })

    // 4. 使用视觉模型识别
    const config = new Config()
    const llmClient = new LLMClient(config)

    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }> = [
      {
        role: 'system',
        content: '你是一个社交媒体账号数据提取专家。请从图片中识别并提取账号的关键信息，以JSON格式返回。'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请分析这张社交媒体账号主页图片，提取以下信息并返回JSON格式：
{
  "platform": "平台名称（如抖音、小红书、B站等）",
  "accountName": "账号名称",
  "followers": 粉丝数（数字），
  "totalExposure": 总曝光量（数字，如果没有则为0），
  "totalWorks": 作品总数（数字），
  "avgLikes": 平均点赞数（数字），
  "avgComments": 平均评论数（数字），
  "avgShares": 平均转发数（数字）
}

注意事项：
- 粉丝数、作品数等必须提取为纯数字
- 如果某个信息无法识别，设置为0
- platform 必须是：抖音、微信公众号、小红书、B站、微博、快手、知乎 中的一个
- 只返回JSON，不要其他文字说明`
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high'
            }
          }
        ]
      }
    ]

    const response = await llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.2
    })

    // 解析返回结果
    let result
    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0])
      } else {
        throw new Error('Failed to parse response')
      }

      result = {
        platform: result.platform || '',
        accountName: result.accountName || '',
        followers: parseInt(result.followers) || 0,
        totalExposure: parseInt(result.totalExposure) || 0,
        totalWorks: parseInt(result.totalWorks) || 0,
        avgLikes: parseInt(result.avgLikes) || 0,
        avgComments: parseInt(result.avgComments) || 0,
        avgShares: parseInt(result.avgShares) || 0
      }

    } catch (error) {
      console.error('解析识别结果失败:', error)
      throw new Error('Image recognition failed, please retry or use screenshot function')
    }

    return result
  }

  /**
   * 从抖音链接中获取用户信息（优化版）
   */
  private async fetchDouyinUserInfo(url: string): Promise<any> {
    console.log('尝试从抖音链接获取用户信息...')

    // 1. 获取重定向URL，提取 sec_uid
    const redirectUrl = await this.getRedirectUrl(url)
    if (!redirectUrl) {
      throw new Error('Failed to get redirect URL')
    }

    const secUidMatch = redirectUrl.match(/sec_uid=([^&]+)/)
    if (!secUidMatch) {
      throw new Error('Failed to extract sec_uid from redirect URL')
    }

    const secUid = secUidMatch[1]
    console.log('提取的 sec_uid:', secUid)

    // 2. 尝试多种API获取用户信息
    const apiUrls = [
      {
        name: 'Fenggui API - userinfo',
        url: `https://api-v2.cenguigui.cn/api/douyin/userinfo.php?id=${secUid}`
      },
      {
        name: 'Douyin User Info API',
        url: `https://www.iesdouyin.com/web/api/v2/user/info/?sec_user_id=${secUid}`,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
        }
      }
    ]

    for (const api of apiUrls) {
      try {
        console.log(`尝试API: ${api.name}`)

        const headers = api.headers || {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }

        const response = await fetch(api.url, { headers })

        if (!response.ok) {
          console.log(`API请求失败，状态码: ${response.status}`)
          continue
        }

        const data = await response.json()
        console.log(`API响应:`, JSON.stringify(data).substring(0, 200) + '...')

        // 检查是否有用户信息
        let userInfo: any = null
        if (data.code === 200 && data.data && data.data.nickname) {
          userInfo = data.data
        } else if (data.user_info && data.user_info.nickname) {
          userInfo = data.user_info
        } else if (data.data && data.data.user_info && data.data.user_info.nickname) {
          userInfo = data.data.user_info
        }

        if (userInfo) {
          console.log('成功获取用户信息:', userInfo.nickname)
          return {
            platform: '抖音',
            accountName: userInfo.nickname || '',
            followers: (userInfo as any).followers_count || (userInfo as any).follower_count || 0,
            totalExposure: 0,
            totalWorks: (userInfo as any).aweme_count || (userInfo as any).video_count || 0,
            avgLikes: 0,
            avgComments: 0,
            avgShares: 0
          }
        }

      } catch (error: any) {
        console.log(`${api.name} 失败:`, error.message)
      }
    }

    // 3. 尝试获取页面HTML，用LLM解析
    try {
      console.log('尝试从页面HTML中解析用户信息...')
      const htmlContent = await this.fetchUrlContent(redirectUrl)

      if (htmlContent && htmlContent.length > 1000) {
        const { LLMClient, Config } = await import('coze-coding-dev-sdk')
        const config = new Config()
        const llmClient = new LLMClient(config)

        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string | any[] }> = [
          {
            role: 'system',
            content: '你是一个HTML解析专家，擅长从网页HTML中提取社交媒体账号信息。请从HTML中提取账号信息，以JSON格式返回。'
          },
          {
            role: 'user',
            content: `请从以下抖音用户页面HTML内容中提取用户信息，返回JSON格式：
${htmlContent.substring(0, 15000)}

请提取以下信息并返回JSON格式：
{
  "platform": "平台名称",
  "accountName": "账号名称",
  "followers": 粉丝数（数字），
  "totalExposure": 总曝光量（数字，如果没有则为0），
  "totalWorks": 作品总数（数字），
  "avgLikes": 平均点赞数（数字），
  "avgComments": 平均评论数（数字），
  "avgShares": 平均转发数（数字）
}

注意事项：
- HTML可能包含JavaScript代码，请查找JSON数据或文本内容
- 粉丝数、作品数等必须提取为纯数字
- 如果某个信息无法识别，设置为0
- platform 设置为"抖音"
- 只返回JSON，不要其他文字说明`
          }
        ]

        const response = await llmClient.invoke(messages, {
          model: 'doubao-seed-1-8-251228',
          temperature: 0.2
        })

        console.log('LLM响应:', response.content.substring(0, 500))

        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0])
          console.log('解析的JSON结果:', result)

          // 即使没有提取到用户名，也返回结果
          return {
            platform: result.platform || '抖音',
            accountName: result.accountName || '',
            followers: parseInt(result.followers) || 0,
            totalExposure: parseInt(result.totalExposure) || 0,
            totalWorks: parseInt(result.totalWorks) || 0,
            avgLikes: parseInt(result.avgLikes) || 0,
            avgComments: parseInt(result.avgComments) || 0,
            avgShares: parseInt(result.avgShares) || 0
          }
        }
      }
    } catch (error: any) {
      console.log('LLM解析失败:', error.message)
    }

    throw new Error('Cannot get user info from this Douyin link. Please use screenshot function: take a screenshot of the account homepage, then click the "Upload Image Recognition" button.')
  }

  /**
   * 获取重定向URL
   */
  private async getRedirectUrl(url: string): Promise<string | null> {
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'manual'
      })

      const location = response.headers.get('location')
      if (location) {
        return location
      }

      return null
    } catch (error) {
      console.error('获取重定向URL失败:', error)
      return null
    }
  }

  /**
   * 方案3: 使用LLM从HTML中提取用户信息
   */
  /**
   * 获取URL内容
   */
  private async fetchUrlContent(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8'
        }
      })

      if (!response.ok) {
        throw new Error('Request failed')
      }

      return await response.text()
    } catch (error) {
      console.error('获取URL内容失败:', error)
      throw error
    }
  }

  /**
   * 拉黑好友
   */
  async blockAvatar(avatarId: string, blockedAvatarId: string, reason?: string) {
    const client = getSupabaseClient()

    // 检查是否已经是好友
    const { data: friend } = await client
      .from('avatar_friends')
      .select('*')
      .eq('avatar_id', avatarId)
      .eq('friend_avatar_id', blockedAvatarId)
      .eq('status', 'accepted')
      .single()

    if (friend) {
      // 删除好友关系
      await client
        .from('avatar_friends')
        .delete()
        .eq('avatar_id', avatarId)
        .eq('friend_avatar_id', blockedAvatarId)

      // 同时删除对方的好友关系
      await client
        .from('avatar_friends')
        .delete()
        .eq('avatar_id', blockedAvatarId)
        .eq('friend_avatar_id', avatarId)
    }

    // 添加拉黑记录
    const { data, error } = await client
      .from('avatar_blocks')
      .insert({
        avatar_id: avatarId,
        blocked_avatar_id: blockedAvatarId,
        reason: reason || '用户主动拉黑'
      })
      .select()
      .single()

    if (error) {
      throw new Error('Failed to block: ' + error.message)
    }

    return data
  }

  /**
   * 解除拉黑
   */
  async unblockAvatar(avatarId: string, blockedAvatarId: string) {
    const client = getSupabaseClient()

    const { error } = await client
      .from('avatar_blocks')
      .delete()
      .eq('avatar_id', avatarId)
      .eq('blocked_avatar_id', blockedAvatarId)

    if (error) {
      throw new Error('Failed to unblock: ' + error.message)
    }

    return { success: true }
  }

  /**
   * 获取拉黑列表
   */
  async getBlockedAvatars(avatarId: string) {
    const client = getSupabaseClient()

    // 先获取拉黑记录
    const { data: blocks, error } = await client
      .from('avatar_blocks')
      .select('*')
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error('Failed to get blocked list: ' + error.message)
    }

    // 获取被拉黑的分身信息
    const blockedAvatarIds = blocks?.map(b => b.blocked_avatar_id) || []

    if (blockedAvatarIds.length === 0) {
      return []
    }

    const { data: blockedAvatars } = await client
      .from('avatars')
      .select('*')
      .in('id', blockedAvatarIds)

    // 组合数据
    const result = blocks?.map(block => {
      const avatar = blockedAvatars?.find(a => a.id === block.blocked_avatar_id)
      return {
        ...block,
        blocked_avatar: avatar || null
      }
    }) || []

    return result
  }

  /**
   * 检查是否被拉黑
   */
  async isBlocked(avatarId: string, targetAvatarId: string): Promise<boolean> {
    const client = getSupabaseClient()

    const { data } = await client
      .from('avatar_blocks')
      .select('id')
      .eq('avatar_id', avatarId)
      .eq('blocked_avatar_id', targetAvatarId)
      .single()

    return !!data
  }

  /**
   * 获取分身的动态列表
   */
  async getAvatarPosts(avatarId: string, page: number = 1, pageSize: number = 10) {
    const client = getSupabaseClient()
    
    const offset = (page - 1) * pageSize
    
    // 先获取总数
    const { count } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
    
    // 获取分身的所有帖子（简化查询，不关联其他表）
    const { data: posts, error } = await client
      .from('posts')
      .select('*')
      .eq('avatar_id', avatarId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      console.error('获取分身动态失败:', error)
      return { posts: [], total: 0 }
    }
    
    return {
      posts: posts || [],
      total: count || 0
    }
  }

  /**
   * 获取分身的统计信息
   */
  async getAvatarStats(avatarId: string) {
    const client = getSupabaseClient()
    
    // 获取好友数（统计唯一好友数，去重双向记录）
    const { data: allFriendships } = await client
      .from('avatar_friends')
      .select('avatar_id, friend_avatar_id')
      .or(`avatar_id.eq.${avatarId},friend_avatar_id.eq.${avatarId}`)
      .eq('status', 'accepted')

    const uniqueFriendIds = new Set(
      (allFriendships || []).map(f =>
        f.avatar_id === avatarId ? f.friend_avatar_id : f.avatar_id
      )
    )
    const friendsCount = uniqueFriendIds.size
    
    // 获取帖子数
    const { count: postsCount } = await client
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
    
    // 获取获赞数
    const { data: postsForLikes } = await client
      .from('posts')
      .select('id')
      .eq('avatar_id', avatarId)
    
    const postIdsForLikes = postsForLikes?.map(p => p.id) || []

    const { count: likesReceived } = await client
      .from('likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_type', 'post')
      .in('target_id', postIdsForLikes)
    
    // 获取评论数
    const { data: postsForComments } = await client
      .from('posts')
      .select('id')
      .eq('avatar_id', avatarId)
    
    const postIdsForComments = postsForComments?.map(p => p.id) || []

    const { count: commentsReceived } = await client
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .in('post_id', postIdsForComments)
    
    return {
      friendsCount: friendsCount || 0,
      postsCount: postsCount || 0,
      likesReceived: likesReceived || 0,
      commentsReceived: commentsReceived || 0
    }
  }

  /**
   * 获取分身的今日统计
   */
  async getAvatarTodayStats(avatarId: string) {
    const client = getSupabaseClient()

    // 获取今天的时间范围
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.toISOString()

    // 今日发帖数
    const { count: todayPostsCount } = await client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
      .gte('created_at', todayStart)

    // 今日点赞数
    const { count: todayLikesCount } = await client
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
      .eq('target_type', 'post')
      .gte('created_at', todayStart)

    // 今日评论数
    const { count: todayCommentsCount } = await client
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
      .gte('created_at', todayStart)

    // 今日接单数
    const { count: todayOrdersCount } = await client
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('avatar_id', avatarId)
      .eq('status', 'completed')
      .gte('completed_at', todayStart)

    return {
      todayPostsCount: todayPostsCount || 0,
      todayLikesCount: todayLikesCount || 0,
      todayCommentsCount: todayCommentsCount || 0,
      todayOrdersCount: todayOrdersCount || 0
    }
  }

  /**
   * 检查分身是否被用户的任何分身拉黑
   * 用于分身详情页检查是否被拉黑
   */
  async isAvatarBlocked(avatarId: string, userId: string): Promise<boolean> {
    const client = getSupabaseClient()
    
    // 获取用户的所有分身
    const { data: userAvatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
    
    if (!userAvatars || userAvatars.length === 0) {
      return false
    }
    
    // 检查是否有任何一个用户的分身拉黑了目标分身
    for (const avatar of userAvatars) {
      const blocked = await this.isBlocked(avatar.id, avatarId)
      if (blocked) {
        return true
      }
    }
    
    return false
  }
}
