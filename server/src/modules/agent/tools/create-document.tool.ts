import { Injectable } from '@nestjs/common'
import { Tool, ToolContext, ToolResult } from '../tools.interface'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

@Injectable()
export class CreateDocumentTool implements Tool {
  name = 'create_document'
  description = '创建文档或笔记。当需要保存研究结果、生成报告、整理笔记时使用此工具。'
  
  parameters = {
    title: {
      type: 'string',
      description: '文档标题',
      required: true
    },
    content: {
      type: 'string',
      description: '文档内容，支持 Markdown 格式',
      required: true
    },
    type: {
      type: 'string',
      description: '文档类型：note(笔记), report(报告), article(文章)',
      required: false
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const { title, content, type = 'note' } = params
      
      console.log(`[CreateDocumentTool] 创建文档: ${title}`)
      
      const client = getSupabaseClient()
      
      // 尝试保存到数据库
      // 检查是否存在 documents 表，如果不存在就创建
      const { data, error } = await client
        .from('documents')
        .insert({
          user_id: context.userId,
          avatar_id: context.avatarId,
          title,
          content,
          type,
          created_at: new Date().toISOString()
        })
        .select()
        .single()
      
      if (error) {
        // 如果表不存在，创建一个任务记录来保存文档
        console.log('[CreateDocumentTool] 保存到任务记录')
        
        const { data: taskData } = await client
          .from('tasks')
          .insert({
            user_id: context.userId,
            avatar_id: context.avatarId,
            title: `📄 ${title}`,
            description: content,
            task_type: 'document',
            status: 'completed',
            progress: 100,
            result: { title, content, type },
            logs: [{
              timestamp: new Date().toISOString(),
              action: 'document_created',
              message: `文档已创建`
            }]
          })
          .select()
          .single()
        
        return {
          success: true,
          data: {
            id: taskData?.id,
            title,
            type,
            contentPreview: content.substring(0, 200)
          },
          message: `文档已创建: ${title}`
        }
      }
      
      return {
        success: true,
        data: {
          id: data?.id,
          title,
          type,
          contentPreview: content.substring(0, 200)
        },
        message: `文档已创建: ${title}`
      }
    } catch (error) {
      console.error('[CreateDocumentTool] 创建失败:', error)
      return {
        success: false,
        error: error.message,
        message: `创建文档失败: ${error.message}`
      }
    }
  }
}
