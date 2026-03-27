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
    
    const { data, error } = await client
      .from('avatars')
      .insert({
        user_id: userId,
        name: avatarData.name || '我的AI分身',
        description: avatarData.description || '',
        avatar_url: avatarData.photo_url || avatarData.avatar_url || '',
        personality: avatarData.personality || '',
        skills: avatarData.abilities || avatarData.skills || [],
        config: {
          style: avatarData.style,
          photo_analysis: avatarData.photo_analysis,
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
   * 上传照片并分析
   * 1. 上传照片到对象存储
   * 2. 使用视觉模型分析照片
   * 3. 返回分析结果和照片URL
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
    
    // 3. 使用视觉模型分析照片
    const analysis = await this.analyzePhotoWithVision(photoUrl)
    
    return {
      photoUrl,
      fileKey,
      analysis,
    }
  }

  /**
   * 使用视觉模型分析照片
   */
  private async analyzePhotoWithVision(photoUrl: string) {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      
      const messages = [
        {
          role: 'user' as const,
          content: [
            {
              type: 'text' as const,
              text: `请分析这张照片中人物的特征，用于创建AI分身形象。请从以下几个方面分析：

1. 整体印象：用一句话描述这个人的气质特征
2. 情感特质：列出2-3个可能的性格特点
3. 建议的AI分身名字：根据照片特征建议1个合适的名字

请以JSON格式返回，格式如下：
{
  "description": "整体印象描述",
  "emotions": ["特质1", "特质2"],
  "traits": ["性格特点1", "性格特点2", "性格特点3"],
  "suggestedName": "建议的名字"
}

注意：请只返回JSON，不要有其他文字。`,
            },
            {
              type: 'image_url' as const,
              image_url: {
                url: photoUrl,
                detail: 'low' as const, // 使用低细节以节省token
              },
            },
          ],
        },
      ]
      
      const response = await client.invoke(messages, {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.7,
      })
      
      console.log('视觉模型响应:', response.content)
      
      // 解析JSON响应
      try {
        // 尝试提取JSON
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0])
        }
      } catch (parseError) {
        console.error('解析JSON失败:', parseError)
      }
      
      // 如果解析失败，返回默认分析
      return {
        description: '看起来是一位充满活力的人',
        emotions: ['积极', '自信'],
        traits: ['开朗', '专注', '有创造力'],
        suggestedName: '小墨',
      }
    } catch (error) {
      console.error('视觉模型分析失败:', error)
      // 返回默认分析结果
      return {
        description: '看起来是一位有魅力的人',
        emotions: ['温暖', '友善'],
        traits: ['细心', '有耐心', '善于思考'],
        suggestedName: '小墨',
      }
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
    
    // 获取当前分身信息
    const avatar = await this.getAvatarById(avatarId)
    const newExp = avatar.exp + exp
    
    // 计算新等级（每100经验升一级）
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
    
    // 记录进化日志
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
