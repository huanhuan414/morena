/**
 * Platform Publish Tools
 * 平台发布工具
 */

import { Injectable } from '@nestjs/common'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import { getMySQLClient } from '../../../storage/database/mysql-client'

@Injectable()
export class PublishWechatMpTool implements AvatarTool {
  name = 'publish_wechat_mp'
  displayName = '发布公众号文章'
  description = '发布文章到微信公众号素材库'
  category = 'platform_publish' as const

  paramsSchema = {
    title: { type: 'string' as const, description: '文章标题', required: true },
    content: { type: 'string' as const, description: '文章内容', required: true },
    cover_url: { type: 'string' as const, description: '封面图片URL' }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const db = getMySQLClient()
      const configs = await db.query('platform_configs', { user_id: context.userId, platform_type: 'wechat_mp' })

      if (!configs?.data || configs.data.length === 0) {
        return { success: false, toolName: this.name, error: '未配置微信公众号', requires_config: true }
      }

      const config = configs.data[0]
      const appId = config.config?.app_id
      const appSecret = config.config?.app_secret

      if (!appId || !appSecret) {
        return { success: false, toolName: this.name, error: '微信公众号配置不完整' }
      }

      // 获取 access_token
      const tokenRes = await fetch(`https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`)
      const tokenData = await tokenRes.json()

      if (tokenData.errcode) {
        return { success: false, toolName: this.name, error: `微信API错误: ${tokenData.errmsg}` }
      }

      // 创建草稿（简化实现）
      const htmlContent = params.content.replace(/\n/g, '<br/>')
      const draftData = {
        articles: [{
          title: params.title,
          content: htmlContent,
          thumb_media_id: ''
        }]
      }

      const draftRes = await fetch(`https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${tokenData.access_token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftData)
      })
      const result = await draftRes.json()

      if (result.errcode) {
        return { success: false, toolName: this.name, error: `创建草稿失败: ${result.errmsg}` }
      }

      return { success: true, toolName: this.name, data: { media_id: result.media_id } }
    } catch (error: any) {
      return { success: false, toolName: this.name, error: error.message }
    }
  }
}
