import { Injectable } from '@nestjs/common'
import { Tool, ToolExecutionContext, ToolResult } from '../tools.interface'
import { getMySQLClient } from '../../../storage/database/mysql-client'
import * as crypto from 'crypto'

@Injectable()
export class CreateDocumentTool implements Tool {
  name = 'create_document'
  description = '创建文档或笔记。当需要保存研究结果、生成报告、整理笔记时使用此工具。'

  parameters = {
    title: { type: 'string', description: '文档标题', required: true },
    content: { type: 'string', description: '文档内容，支持 Markdown 格式', required: true },
    type: { type: 'string', description: '文档类型：note(笔记), report(报告), article(文章)' }
  }

  async execute(params: Record<string, any>, context: ToolExecutionContext): Promise<ToolResult> {
    try {
      const { title, content, type = 'note' } = params
      const db = getMySQLClient()

      const id = crypto.randomUUID()
      await db.insert('tasks', {
        id,
        user_id: context.userId,
        avatar_id: context.avatarId,
        title: `📄 ${title}`,
        description: content,
        task_type: 'document',
        status: 'completed',
        progress: 100,
        result: JSON.stringify({ title, content, type }),
        created_at: new Date(),
        updated_at: new Date()
      })

      return {
        success: true,
        message: "操作成功",
        data: { id, title, type, message: '文档已创建' }
      }
    } catch (err: any) {
      return { success: false, error: err.message, message: "操作失败" }
    }
  }
}
