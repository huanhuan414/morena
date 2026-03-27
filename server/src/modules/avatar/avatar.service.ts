import { Injectable } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'
import { S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class AvatarService {
  private storage: S3Storage

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    })
  }

  async createAvatar(userId: string, avatarData: Record<string, any>) {
    const client = getSupabaseClient()
    
    // 从图片分析结果构建分身配置
    const photoAnalysis = avatarData.photo_analysis || {}
    
    const { data, error } = await client
      .from('avatars')
      .insert({
        user_id: userId,
        name: avatarData.name || '我的AI分身',
        description: this.generateDescription(photoAnalysis, avatarData),
        avatar_url: avatarData.photo_url || avatarData.avatar_url || '',
        personality: avatarData.personality || photoAnalysis.recommendedType || 'friendly',
        skills: avatarData.abilities || avatarData.skills || [],
        config: {
          style: avatarData.style || 'tech',
          photo_analysis: photoAnalysis,
          // 从图片分析中提取的个性化配置
          temperament: photoAnalysis.temperament,
          communicationStyle: photoAnalysis.communicationStyle,
          strengths: photoAnalysis.strengths,
        },
        level: 1,
        exp: 0,
        status: 'active'
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建分身失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 生成分身描述
   */
  private generateDescription(photoAnalysis: any, avatarData: any): string {
    const parts: string[] = []
    
    if (photoAnalysis.temperament?.type) {
      parts.push(`气质类型：${photoAnalysis.temperament.type}`)
    }
    
    if (photoAnalysis.strengths?.length > 0) {
      parts.push(`擅长：${photoAnalysis.strengths.join('、')}`)
    }
    
    if (photoAnalysis.communicationStyle) {
      parts.push(`沟通风格：${photoAnalysis.communicationStyle}`)
    }
    
    return parts.join(' | ') || '一个友好、乐于助人的AI分身'
  }

  /**
   * 上传照片并进行深度分析
   */
  async analyzePhoto(file: Express.Multer.File) {
    console.log('开始分析照片:', file.originalname, file.mimetype, file.size)
    
    // 1. 上传照片到对象存储
    const fileKey = await this.storage.uploadFile({
      fileContent: file.buffer,
      fileName: `avatars/${Date.now()}_${file.originalname}`,
      contentType: file.mimetype || 'image/jpeg',
    })
    
    console.log('照片上传成功, key:', fileKey)
    
    // 2. 生成可访问的URL
    const photoUrl = await this.storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 30, // 30天有效期
    })
    
    console.log('生成照片URL:', photoUrl)
    
    // 3. 使用视觉模型进行深度分析
    const analysis = await this.deepAnalyzePhoto(photoUrl)
    
    return {
      photoUrl,
      fileKey,
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
      
      const analysisPrompt = `你是一位专业的AI分身形象设计师和人格分析师。请仔细分析这张照片中人物的特征，用于创建一个高度个性化的AI分身。

请从以下维度进行深度分析：

## 1. 面部特征分析
- 表情特点（自然/微笑/严肃等）
- 眼神特点（温和/锐利/深邃等）
- 整体面部印象

## 2. 气质类型判断
根据面部特征和表情，判断气质类型（从以下选项中选择）：
- 阳光活力型：开朗外向，充满正能量
- 沉稳内敛型：深思熟虑，稳重可靠
- 创意艺术型：思维活跃，富有想象
- 专业精英型：干练高效，目标明确
- 温暖治愈型：善解人意，富有同理心

## 3. 性格特征推断
基于面部表情和神态，推断3-5个核心性格特质

## 4. 沟通风格预测
预测这个人在沟通时可能的特点：
- 语言风格（简洁/详尽/幽默/严肃）
- 表达方式（直接/委婉/理性/感性）
- 倾听习惯（耐心/主动/互动型）

## 5. 擅长领域建议
根据气质和特征，推荐分身可能擅长的能力领域

## 6. 分身命名建议
根据整体分析，建议3个合适的分身名字，并说明理由

请以JSON格式返回，格式如下：
{
  "facialFeatures": {
    "expression": "表情描述",
    "eyes": "眼神描述",
    "impression": "整体印象"
  },
  "temperament": {
    "type": "气质类型",
    "description": "气质描述",
    "keywords": ["关键词1", "关键词2"]
  },
  "personality": {
    "core": ["核心特质1", "核心特质2", "核心特质3"],
    "strengths": ["优点1", "优点2"],
    "workStyle": "工作风格描述"
  },
  "communicationStyle": "沟通风格描述",
  "strengths": ["擅长领域1", "擅长领域2", "擅长领域3"],
  "recommendedType": "推荐的分身类型(creative/analytical/empathetic/strategic)",
  "nameSuggestions": [
    { "name": "名字1", "reason": "理由" },
    { "name": "名字2", "reason": "理由" },
    { "name": "名字3", "reason": "理由" }
  ],
  "summary": "一句话总结这个人的特点",
  "suggestedName": "最推荐的名字"
}

注意：
1. 请只返回JSON，不要有其他文字
2. 分析要基于照片特征，客观且积极正面
3. 如果无法识别面部（如非人物照片），请返回合理的默认值`

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
      
      // 解析JSON响应
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0])
          console.log('解析成功，气质类型:', analysis.temperament?.type)
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
   * 获取默认分析结果
   */
  private getDefaultAnalysis() {
    return {
      facialFeatures: {
        expression: '自然温和',
        eyes: '明亮有神',
        impression: '给人一种亲切可靠的感觉'
      },
      temperament: {
        type: '阳光活力型',
        description: '开朗外向，充满正能量，善于与人沟通',
        keywords: ['活力', '热情', '积极']
      },
      personality: {
        core: ['开朗', '细心', '有责任心'],
        strengths: ['善于沟通', '执行力强'],
        workStyle: '高效务实，注重细节'
      },
      communicationStyle: '直接明了，善于倾听，能够准确理解他人需求',
      strengths: ['对话交流', '信息整理', '任务执行'],
      recommendedType: 'empathetic',
      nameSuggestions: [
        { name: '小墨', reason: '简洁有亲和力，适合日常互动' },
        { name: '星云', reason: '富有想象力，适合创意任务' },
        { name: '智慧星', reason: '突出智能特性，适合知识问答' }
      ],
      summary: '一位温暖而专业的伙伴，能够高效完成各种任务',
      suggestedName: '小墨'
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
      throw new Error(`获取分身列表失败: ${error.message}`)
    }
    
    return data
  }

  async getAvatarById(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    if (error) {
      throw new Error(`获取分身详情失败: ${error.message}`)
    }
    
    return data
  }

  async updateAvatar(avatarId: string, userId: string, updates: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新分身失败: ${error.message}`)
    }
    
    return data
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
      throw new Error(`更新分身经验失败: ${error.message}`)
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

  async deleteAvatar(avatarId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('avatars')
      .delete()
      .eq('id', avatarId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除分身失败: ${error.message}`)
    }
    
    return { success: true }
  }
}
