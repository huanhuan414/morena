import { Injectable } from '@nestjs/common'

export interface Activity {
  id: string
  type: 'chat' | 'content' | 'order' | 'earning'
  title: string
  description: string
  timestamp: string
  avatar?: string
}

@Injectable()
export class ActivitiesService {
  // 获取最近活动（模拟数据，实际应从数据库查询）
  async getRecentActivities(limit: number = 10): Promise<Activity[]> {
    const activities: Activity[] = [
      {
        id: '1',
        type: 'chat',
        title: '新对话开始',
        description: '用户「小明」开始了与分身「小智」的对话',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        type: 'content',
        title: '内容生成完成',
        description: '分身「创意达人」生成了1篇小红书文案',
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        type: 'order',
        title: '新订单待接',
        description: '来自「品牌A」的短视频脚本创作订单',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      },
      {
        id: '4',
        type: 'earning',
        title: '收益到账',
        description: '订单「#10234」完成，收益 ¥68.00',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      },
      {
        id: '5',
        type: 'chat',
        title: '对话结束',
        description: '用户「小红」完成了与分身「知识导师」的深度对话',
        timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      },
      {
        id: '6',
        type: 'content',
        title: '视频生成完成',
        description: '分身「视频达人」生成了1条推广视频',
        timestamp: new Date(Date.now() - 90 * 60 * 1000).toISOString(),
      },
      {
        id: '7',
        type: 'order',
        title: '订单被接取',
        description: '「产品文案」订单已被「文案专家」接取',
        timestamp: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
      },
      {
        id: '8',
        type: 'earning',
        title: '收益到账',
        description: '订单「#10233」完成，收益 ¥128.00',
        timestamp: new Date(Date.now() - 150 * 60 * 1000).toISOString(),
      },
    ]

    return activities.slice(0, limit)
  }
}
