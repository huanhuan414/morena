// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class AvatarLearningService {
  async learnFromInteraction(avatarId: number, interactionData: any) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_learning', {
      avatar_id: avatarId,
      interaction_type: interactionData.type || 'general',
      content: interactionData.content || '',
      learned_patterns: JSON.stringify(interactionData.patterns || {}),
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async getLearnedPatterns(avatarId: number) {
    const db = getMySQLClient()
    const result = await db.select('avatar_learning', { avatar_id: avatarId })
    return result.data?.map((item: any) => ({
      type: item.interaction_type,
      content: item.content,
      patterns: JSON.parse(item.learned_patterns || '{}')
    })) || []
  }

  async learnFromResult(avatarId: number, resultData: any) {
    const db = getMySQLClient()
    const result = await db.insert('avatar_learning', {
      avatar_id: avatarId,
      interaction_type: 'result_feedback',
      content: JSON.stringify(resultData),
      learned_patterns: '{}',
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async updateSkillLevel(avatarId: number, skillId: number, level: number) {
    const db = getMySQLClient()
    const result = await db.updateWhere('avatar_skills', { id: skillId, avatar_id: avatarId }, {
      level,
      updated_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }
}
