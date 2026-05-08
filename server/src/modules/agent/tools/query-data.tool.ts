import { Injectable } from '@nestjs/common'
import { Tool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { getMySQLClient } from '../../../storage/database/mysql-client'

@Injectable()
export class QueryDataTool implements Tool {
  name = 'query_data'
  description = '查询用户的数据，包括任务、分身信息等。当需要了解用户的历史数据时使用此工具。'

  parameters = {
    data_type: { type: 'string', description: '数据类型：tasks, avatars, conversations', required: true },
    filter: { type: 'object', description: '筛选条件' },
    limit: { type: 'number', description: '返回数量限制，默认10' }
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const { data_type, filter = {}, limit = 10 } = params
      const db = getMySQLClient()
      let result: any = {}

      switch (data_type) {
        case 'tasks':
          const tasksFilter: any = { user_id: context.userId }
          if (filter.status) tasksFilter.status = filter.status
          const tasks = await db.query('tasks', tasksFilter)
          result = { tasks: (tasks?.data || []).slice(0, limit) }
          break

        case 'avatars':
          const avatars = await db.query('avatars', { user_id: context.userId })
          result = { avatars: avatars || [] }
          break

        case 'conversations':
          const convFilter: any = { user_id: context.userId }
          const conversations = await db.query('conversations', convFilter)
          result = { conversations: (conversations?.data || []).slice(0, limit) }
          break

        default:
          return { success: false, error: `不支持的数据类型: ${data_type}`, message: '不支持的数据类型' }
      }

      return { success: true, data: result, message: '查询成功' }
    } catch (err: any) {
      return { success: false, error: err.message, message: '查询失败' }
    }
  }
}
