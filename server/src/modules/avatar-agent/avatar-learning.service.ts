/**
 * Avatar Learning Service
 * 分身学习服务
 */

import { Injectable, Logger } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'
import { AvatarMemoryService } from './avatar-memory.service'
import {
  AvatarThought,
  AvatarActionResult,
  AvatarResponse,
  Interaction
} from './avatar-agent.types'

@Injectable()
export class AvatarLearningService {
  private readonly logger = new Logger(AvatarLearningService.name)

  constructor(private readonly memoryService: AvatarMemoryService) {}

  /**
   * 从结果中学习
   */
  async learnFromResult(
    avatarId: string,
    thought: AvatarThought,
    result: AvatarActionResult
  ): Promise<void> {
    try {
      // 1. 记录学习数据
      const feedbackScore = result.success ? 5 : 1

      const { error } = await getSupabaseClient()
        .from('avatar_learning_records')
        .insert({
          avatar_id: avatarId,
          learning_type: 'task_completion',
          input_data: {
            thought: thought.content,
            intent: thought.intent,
            requires_tool: thought.requiresTool
          },
          output_data: result,
          feedback_score: feedbackScore,
          learned_knowledge: result.success
            ? `成功执行任务: ${thought.content}`
            : `任务执行失败: ${result.error}`
        })

      if (error) {
        this.logger.error('Failed to record learning:', error)
        return
      }

      // 2. 如果成功，存储为经验
      if (result.success) {
        await this.memoryService.storeExperience(avatarId, {
          description: `成功执行任务: ${thought.content}`,
          taskType: thought.intent.type,
          success: true,
          outcome: result.data
        })
      }

      this.logger.log(`Learned from result for avatar ${avatarId}: ${result.success}`)
    } catch (error) {
      this.logger.error('Error learning from result:', error)
    }
  }

  /**
   * 更新技能熟练度
   */
  async updateSkillProficiency(
    avatarId: string,
    thought: AvatarThought,
    response: AvatarResponse
  ): Promise<void> {
    try {
      const skillType = thought.intent.skillType || thought.intent.type
      if (!skillType || skillType === 'unknown') return

      // 查找现有技能
      const { data: existingSkill, error: queryError } = await getSupabaseClient()
        .from('avatar_skills')
        .select('*')
        .eq('avatar_id', avatarId)
        .eq('skill_type', skillType)
        .single()

      if (queryError && queryError.code !== 'PGRST116') {
        // PGRST116 表示没有找到记录
        this.logger.error('Error querying skill:', queryError)
        return
      }

      const feedback = response.metadata?.feedback_score || 3 // 1-5

      if (existingSkill) {
        // 更新现有技能
        const currentProficiency = parseFloat(existingSkill.proficiency)
        const newProficiency = (currentProficiency * 0.9) + ((feedback / 5) * 0.1)

        const { error: updateError } = await getSupabaseClient()
          .from('avatar_skills')
          .update({
            proficiency: Math.min(newProficiency, 1),
            usage_count: existingSkill.usage_count + 1,
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingSkill.id)

        if (updateError) {
          this.logger.error('Error updating skill:', updateError)
        }
      } else {
        // 创建新技能
        const { error: insertError } = await getSupabaseClient()
          .from('avatar_skills')
          .insert({
            avatar_id: avatarId,
            skill_type: skillType,
            skill_name: this.getSkillDisplayName(skillType),
            skill_level: 1,
            proficiency: feedback / 5,
            usage_count: 1,
            last_used_at: new Date().toISOString()
          })

        if (insertError) {
          this.logger.error('Error creating skill:', insertError)
        }
      }
    } catch (error) {
      this.logger.error('Error updating skill proficiency:', error)
    }
  }

  /**
   * 个性化学习
   */
  async personalize(
    avatarId: string,
    userId: string,
    interactions: Interaction[]
  ): Promise<void> {
    try {
      // 1. 分析用户偏好
      const preferences = this.analyzeUserPreferences(interactions)

      // 2. 存储偏好记忆
      for (const pref of preferences) {
        await this.memoryService.storePreference(avatarId, userId, pref)
      }

      // 3. 调整分身配置
      await this.adjustAvatarConfig(avatarId, preferences)

      this.logger.log(`Personalized avatar ${avatarId} for user ${userId}`)
    } catch (error) {
      this.logger.error('Error personalizing avatar:', error)
    }
  }

  /**
   * 分析用户偏好
   */
  private analyzeUserPreferences(interactions: Interaction[]): any[] {
    const preferences: any[] = []

    // 分析反馈模式
    const positiveFeedback = interactions.filter(i => i.feedback && i.feedback >= 4)
    const negativeFeedback = interactions.filter(i => i.feedback && i.feedback <= 2)

    // 提取正面反馈的特征
    if (positiveFeedback.length > 0) {
      const commonThemes = this.extractCommonThemes(positiveFeedback.map(i => i.response))
      preferences.push({
        type: 'response_style',
        description: `用户喜欢以下回复风格：${commonThemes.join(', ')}`,
        value: commonThemes
      })
    }

    // 提取负面反馈的特征
    if (negativeFeedback.length > 0) {
      const avoidedThemes = this.extractCommonThemes(negativeFeedback.map(i => i.response))
      preferences.push({
        type: 'avoided_content',
        description: `用户不喜欢以下内容：${avoidedThemes.join(', ')}`,
        value: avoidedThemes
      })
    }

    return preferences
  }

  /**
   * 提取常见主题
   */
  private extractCommonThemes(texts: string[]): string[] {
    // 简化的主题提取
    // 实际应用中可以使用更复杂的 NLP 技术
    const words = texts.join(' ').split(/\s+/)
    const wordCount = new Map<string, number>()

    words.forEach(word => {
      if (word.length > 2) {
        wordCount.set(word, (wordCount.get(word) || 0) + 1)
      }
    })

    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(entry => entry[0])
  }

  /**
   * 调整分身配置
   */
  private async adjustAvatarConfig(
    avatarId: string,
    preferences: any[]
  ): Promise<void> {
    try {
      // 获取当前配置
      const { data: currentConfig, error } = await getSupabaseClient()
        .from('avatar_agent_configs')
        .select('*')
        .eq('avatar_id', avatarId)
        .single()

      if (error || !currentConfig) {
        return
      }

      // 根据偏好调整配置
      let systemPrompt = currentConfig.system_prompt

      // 添加偏好到系统提示词
      const preferenceText = preferences
        .map(p => `- ${p.description}`)
        .join('\n')

      if (!systemPrompt.includes('【用户偏好】')) {
        systemPrompt += `\n\n【用户偏好】\n${preferenceText}`
      } else {
        // 更新现有偏好部分
        systemPrompt = systemPrompt.replace(
          /【用户偏好】[\s\S]*?(?=\n\n|$)/,
          `【用户偏好】\n${preferenceText}`
        )
      }

      // 保存更新的配置
      const { error: updateError } = await getSupabaseClient()
        .from('avatar_agent_configs')
        .update({
          system_prompt: systemPrompt,
          updated_at: new Date().toISOString()
        })
        .eq('avatar_id', avatarId)

      if (updateError) {
        this.logger.error('Error adjusting avatar config:', updateError)
      }
    } catch (error) {
      this.logger.error('Error adjusting avatar config:', error)
    }
  }

  /**
   * 知识蒸馏（从其他分身学习）
   */
  async knowledgeDistillation(
    sourceAvatarId: string,
    targetAvatarId: string
  ): Promise<void> {
    try {
      // 1. 提取源分身的有效经验
      const experiences = await this.memoryService.getAvatarExperiences(
        sourceAvatarId,
        { minSuccessRate: 0.8 }
      )

      // 2. 迁移到目标分身
      for (const exp of experiences) {
        await this.memoryService.storeExperience(targetAvatarId, {
          ...exp,
          description: `[从分身 ${sourceAvatarId} 迁移] ${exp.description}`,
          source: 'distillation'
        })
      }

      this.logger.log(
        `Distilled ${experiences.length} experiences from ${sourceAvatarId} to ${targetAvatarId}`
      )
    } catch (error) {
      this.logger.error('Error in knowledge distillation:', error)
    }
  }

  /**
   * 记录反馈
   */
  async recordFeedback(
    avatarId: string,
    userId: string,
    messageId: string,
    feedbackScore: number,
    feedbackText?: string
  ): Promise<void> {
    try {
      const { error } = await getSupabaseClient()
        .from('avatar_learning_records')
        .insert({
          avatar_id: avatarId,
          learning_type: 'feedback',
          input_data: {
            user_id: userId,
            message_id: messageId
          },
          output_data: {
            feedback_score: feedbackScore,
            feedback_text: feedbackText
          },
          feedback_score: feedbackScore,
          learned_knowledge: feedbackText || `用户反馈: ${feedbackScore}/5`
        })

      if (error) {
        this.logger.error('Failed to record feedback:', error)
      } else {
        this.logger.log(`Recorded feedback for avatar ${avatarId}: ${feedbackScore}/5`)
      }
    } catch (error) {
      this.logger.error('Error recording feedback:', error)
    }
  }

  /**
   * 获取学习统计
   */
  async getLearningStats(avatarId: string): Promise<any> {
    try {
      const { data: records, error } = await getSupabaseClient()
        .from('avatar_learning_records')
        .select('*')
        .eq('avatar_id', avatarId)
        .order('created_at', { ascending: false })

      if (error || !records) {
        return null
      }

      const stats = {
        totalRecords: records.length,
        byType: {} as Record<string, number>,
        averageFeedback: 0,
        successRate: 0
      }

      // 按类型统计
      records.forEach(record => {
        const type = record.learning_type
        stats.byType[type] = (stats.byType[type] || 0) + 1
      })

      // 计算平均反馈
      const feedbackRecords = records.filter(r => r.feedback_score)
      if (feedbackRecords.length > 0) {
        const totalFeedback = feedbackRecords.reduce((sum, r) => sum + r.feedback_score, 0)
        stats.averageFeedback = totalFeedback / feedbackRecords.length
      }

      // 计算成功率
      const successRecords = records.filter(
        r => r.learning_type === 'task_completion' && r.feedback_score >= 4
      )
      if (stats.byType.task_completion > 0) {
        stats.successRate = successRecords.length / stats.byType.task_completion
      }

      return stats
    } catch (error) {
      this.logger.error('Error getting learning stats:', error)
      return null
    }
  }

  /**
   * 获取技能显示名称
   */
  private getSkillDisplayName(skillType: string): string {
    const displayNameMap: Record<string, string> = {
      'conversation': '对话能力',
      'writing': '内容创作',
      'image_gen': '图像生成',
      'video_gen': '视频生成',
      'publishing': '内容发布',
      'customer_service': '客服能力',
      'analysis': '数据分析',
      'planning': '任务规划',
      'problem_solving': '问题解决'
    }

    return displayNameMap[skillType] || skillType
  }
}
