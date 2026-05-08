// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class LearningService {
  async analyzeInteraction(avatarId: string, interactionData: any) {
    const db = getMySQLClient()
    const result = await db.insert('learning_analyses', {
      id: Date.now().toString(),
      avatar_id: avatarId,
      interaction_type: interactionData.type,
      interaction_data: JSON.stringify(interactionData.data || {}),
      analysis_result: JSON.stringify({ insights: [] }),
      created_at: new Date()
    })
    return { success: (result as any).affectedRows > 0 }
  }

  async getInsights(avatarId: string) {
    const db = getMySQLClient()
    const result = await db.select('learning_analyses', { avatar_id: avatarId })
    return result.data?.map((item: any) => ({
      id: item.id,
      type: item.interaction_type,
      data: JSON.parse(item.analysis_result || '{}'),
      createdAt: item.created_at
    })) || []
  }

  async analyzeAndUpdate(avatarId: string, interactionData: any) {
    const db = getMySQLClient()
    await db.insert('learning_analyses', {
      id: Date.now().toString(),
      avatar_id: avatarId,
      interaction_type: interactionData.type || 'general',
      interaction_data: JSON.stringify(interactionData.data || {}),
      analysis_result: JSON.stringify({ insights: [], updated: true }),
      created_at: new Date()
    })
    return { insights: [], updated: true }
  }
}
