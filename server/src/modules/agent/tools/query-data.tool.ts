import { Injectable } from '@nestjs/common'
import { Tool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

@Injectable()
export class QueryDataTool implements Tool {
  name = 'query_data'
  description = '查询用户的数据，包括任务、分身信息等。当需要了解用户的历史数据时使用此工具。'
  
  parameters = {
    data_type: {
      type: 'string',
      description: '要查询的数据类型：tasks(任务), avatars(分身), conversations(对话)',
      required: true
    },
    filter: {
      type: 'object',
      description: '筛选条件，如 { status: "pending" }',
      required: false
    },
    limit: {
      type: 'number',
      description: '返回数量限制，默认10',
      required: false
    }
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const { data_type, filter = {}, limit = 10 } = params
      
      console.log(`[QueryDataTool] 查询数据: ${data_type}`)
      
      const client = getSupabaseClient()
      let query: any
      let result: any
      
      switch (data_type) {
        case 'tasks':
          query = client
            .from('tasks')
            .select('*')
            .eq('user_id', context.userId)
            .order('created_at', { ascending: false })
            .limit(limit)
          
          // 应用筛选条件
          if (filter.status) {
            query = query.eq('status', filter.status)
          }
          if (filter.task_type) {
            query = query.eq('task_type', filter.task_type)
          }
          
          const { data: tasks, error: tasksError } = await query
          if (tasksError) throw tasksError
          result = { tasks }
          break
          
        case 'avatars':
          const { data: avatars, error: avatarsError } = await client
            .from('avatars')
            .select('*')
            .eq('user_id', context.userId)
            .order('created_at', { ascending: false })
          
          if (avatarsError) throw avatarsError
          result = { avatars }
          break
          
        case 'conversations':
          const { data: conversations, error: convError } = await client
            .from('conversations')
            .select('*, avatars(name)')
            .eq('user_id', context.userId)
            .order('updated_at', { ascending: false })
            .limit(limit)
          
          if (convError) throw convError
          result = { conversations }
          break
          
        default:
          return {
            success: false,
            message: `不支持的数据类型: ${data_type}`
          }
      }
      
      const firstValue = Object.values(result)[0]
      const count = Array.isArray(firstValue) ? firstValue.length : 0
      
      return {
        success: true,
        data: result,
        message: `查询成功，找到 ${count} 条数据`
      }
    } catch (error) {
      console.error('[QueryDataTool] 查询失败:', error)
      return {
        success: false,
        error: error.message,
        message: `查询失败: ${error.message}`
      }
    }
  }
}
