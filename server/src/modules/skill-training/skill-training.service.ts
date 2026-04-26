import { Injectable } from '@nestjs/common'
import { LLMClient, Config } from 'coze-coding-dev-sdk'

interface GeneratedSkill {
  name: string
  description: string
  category: string
}

interface SaveSkillDto {
  name: string
  description: string
  category: string
}

@Injectable()
export class SkillTrainingService {
  private llmClient: LLMClient

  constructor() {
    const config = new Config()
    this.llmClient = new LLMClient(config)
  }

  async generateSkill(experience: string, tips?: string): Promise<GeneratedSkill> {
    const systemPrompt = `你是一个专业的技能生成助手。根据用户提供的经验和技巧，生成一个独特的技能。

要求：
1. 技能名称：简洁有力，2-6个字，能体现技能特点
2. 技能描述：详细描述这个技能的功能和使用场景，50-100字
3. 技能分类：选择合适的分类，如"创作"、"分析"、"运营"、"营销"、"技术"等

请以JSON格式返回，格式如下：
{
  "name": "技能名称",
  "description": "技能描述",
  "category": "技能分类"
}`

    const userPrompt = `我的经验：${experience}${tips ? `\n\n我的技巧心得：${tips}` : ''}

请根据以上内容生成一个独特的技能。`

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ]

    try {
      const response = await this.llmClient.invoke(messages, {
        model: 'doubao-seed-1-8-251228',
        temperature: 0.8,
        thinking: 'enabled'
      })

      // 解析 JSON 响应
      const content = response.content
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          name: parsed.name || '自定义技能',
          description: parsed.description || '基于个人经验生成的独特技能',
          category: parsed.category || '其他'
        }
      }

      // 如果解析失败，返回默认结构
      return {
        name: '自定义技能',
        description: `基于${experience.slice(0, 20)}...等经验生成的独特技能`,
        category: '其他'
      }
    } catch (error) {
      console.error('生成技能失败:', error)
      // 返回默认技能
      return {
        name: '自定义技能',
        description: `基于个人经验生成的独特技能：${experience.slice(0, 30)}...`,
        category: '其他'
      }
    }
  }

  async saveSkill(skill: SaveSkillDto): Promise<{ id: string }> {
    // 这里可以实现保存到数据库的逻辑
    // 目前返回模拟数据
    return {
      id: `skill_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }
  }
}
