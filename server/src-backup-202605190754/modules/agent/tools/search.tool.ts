import { Injectable } from '@nestjs/common'
import { SearchClient, Config, HeaderUtils } from 'coze-coding-dev-sdk'
import { Tool, ToolExecutionContext, ToolResult } from '../tools.interface'

@Injectable()
export class SearchTool implements Tool {
  name = 'search'
  description = '搜索互联网获取最新信息。当需要查找实时信息、新闻、资料、数据时使用此工具。'
  
  parameters = {
    query: {
      type: 'string',
      description: '搜索关键词或问题',
      required: true
    },
    count: {
      type: 'number',
      description: '返回结果数量，默认5条',
      required: false
    }
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const query = params.query
      const count = params.count || 5
      
      console.log(`[SearchTool] 执行搜索: ${query}`)
      
      const customHeaders = context.headers ? HeaderUtils.extractForwardHeaders(context.headers as any) : undefined
      const config = new Config()
      const client = new SearchClient(config, customHeaders)
      
      const response = await client.webSearch(query, count, true)
      
      if (!response.web_items || response.web_items.length === 0) {
        return {
          success: false,
          message: `未找到关于 "${query}" 的相关信息`
        }
      }
      
      // 格式化搜索结果
      const results = response.web_items.map((item, index) => ({
        index: index + 1,
        title: item.title,
        url: item.url,
        source: item.site_name,
        snippet: item.snippet,
        publishTime: item.publish_time
      }))
      
      const summary = response.summary || ''
      
      return {
        success: true,
        data: {
          query,
          totalResults: results.length,
          summary,
          results
        },
        message: `找到 ${results.length} 条关于 "${query}" 的结果${summary ? '，已生成摘要' : ''}`
      }
    } catch (error) {
      console.error('[SearchTool] 搜索失败:', error)
      return {
        success: false,
        error: error.message,
        message: `搜索失败: ${error.message}`
      }
    }
  }
}
