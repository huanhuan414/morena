/**
 * 发送消息工具
 */

import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult } from '../agent.types'

// 发送消息工具
export class SendMessageTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'send_message',
    displayName: '发送消息',
    description: '向指定用户或分身发送消息',
    category: 'app_function',
    paramsSchema: {
      to: { type: 'string', description: '接收者ID', required: true },
      message: { type: 'string', description: '消息内容', required: true },
      type: { type: 'string', enum: ['text', 'image', 'voice', 'video'], default: 'text' }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const { to, message, type = 'text' } = params

      if (!to || !message) {
        return {
          success: false,
          error: '缺少必要参数',
          message: '缺少必要参数'
        }
      }

      // 记录消息到数据库
      try {
        const { getMySQLClient } = await import('../../../storage/database/mysql-client')
        const db = getMySQLClient()
        await db.insert('messages', {
          sender_id: context.userId,
          receiver_id: to,
          content: message,
          type: type,
          status: 'sent'
        })
      } catch (e) {
      }


      return {
        success: true,
        data: { message, type, sentAt: new Date().toISOString() },
        message: '发送成功'
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        message: '发送失败'
      }
    }
  }
}
