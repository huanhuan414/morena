/**
 * Content Creation Tools for Avatar Agent - Part 3
 * 平台发布工具
 */

import { Injectable } from '@nestjs/common'
import { AvatarTool, ToolContext, ToolResult } from './tool.interface'
import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { Config, LLMClient, ImageGenerationClient } from 'coze-coding-dev-sdk'

/**
 * 平台配置模板
 */
const PLATFORM_CONFIG_TEMPLATES: Record<string, any> = {
  wechat_mp: {
    name: '微信公众号',
    fields: [
      { key: 'app_id', label: 'AppID', type: 'string', required: true },
      { key: 'app_secret', label: 'AppSecret', type: 'string', required: true }
    ]
  },
  xiaohongshu: {
    name: '小红书',
    fields: []
  },
  wechat_video: {
    name: '微信视频号',
    fields: []
  }
}

/**
 * 发布公众号文章工具
 */
@Injectable()
export class PublishWechatMpTool implements AvatarTool {
  name = 'publish_wechat_mp'
  displayName = '发布公众号文章'
  description = '发布文章到微信公众号素材库，支持根据内容自动配图'
  category = 'platform_publish' as const

  paramsSchema = {
    title: {
      type: 'string' as const,
      description: '文章标题',
      required: true
    },
    content: {
      type: 'string' as const,
      description: '文章内容（Markdown或HTML格式）',
      required: true
    },
    cover_url: {
      type: 'string' as const,
      description: '封面图片URL（可选，不传则根据标题自动生成）'
    },
    digest: {
      type: 'string' as const,
      description: '摘要'
    },
    auto_image: {
      type: 'boolean' as const,
      description: '是否自动配图（默认true）',
      default: true
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
      const client = getSupabaseClient()

      const { data: config, error: configError } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'wechat_mp')
        .maybeSingle()

      if (configError || !config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['wechat_mp']
        return {
          success: false,
          toolName: this.name,
          error: '未配置微信公众号',
          requires_config: true,
          config_platform: 'wechat_mp',
          config_fields: template.fields
        }
      }

      const appId = config.config_data?.app_id
      const appSecret = config.config_data?.app_secret

      // 1. 获取 access_token
      let accessToken: string
      try {
        const accessTokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${appSecret}`
        const tokenRes = await fetch(accessTokenUrl)
        const tokenData = await tokenRes.json()

        if (tokenData.errcode) {
          const errorMsg = this.getWechatErrorMessage(tokenData.errcode)
          return {
            success: false,
            toolName: this.name,
            data: { title: params.title, content: params.content },
            error: `微信API错误: ${errorMsg}`
          }
        }
        accessToken = tokenData.access_token
      } catch (fetchError: any) {
        return {
          success: false,
          toolName: this.name,
          error: `获取access_token失败: ${fetchError.message}`
        }
      }

      // 2. 处理封面图片
      let mediaId: string | undefined
      let usedCoverUrl: string | undefined

      try {
        if (params.cover_url && this.isValidImageUrl(params.cover_url)) {
          for (let retry = 0; retry < 3; retry++) {
            try {
              mediaId = await this.uploadImage(accessToken, params.cover_url)
              usedCoverUrl = params.cover_url
              break
            } catch (uploadErr: any) {
              if (retry < 2) {
                await new Promise(resolve => setTimeout(resolve, 500))
              }
            }
          }
        }

        if (!mediaId) {
          const generatedCoverUrl = await this.generateCoverImage(params.title)
          if (generatedCoverUrl) {
            mediaId = await this.uploadImage(accessToken, generatedCoverUrl)
            usedCoverUrl = generatedCoverUrl
          }
        }
      } catch (coverError: any) {
        console.error('处理封面图片失败:', coverError.message || coverError)
      }

      if (!mediaId) {
        try {
          const defaultCoverUrl = await this.generateDefaultCover(params.title)
          if (defaultCoverUrl) {
            mediaId = await this.uploadImage(accessToken, defaultCoverUrl)
            usedCoverUrl = defaultCoverUrl
          }
        } catch (finalError: any) {
          console.error('生成默认封面也失败:', finalError.message || finalError)
        }
      }

      if (!mediaId) {
        return {
          success: false,
          toolName: this.name,
          error: '封面图片处理失败，无法创建草稿。请稍后重试或联系技术支持。'
        }
      }

      // 3. 根据文章内容生成配图
      let contentWithImages = params.content
      const autoImage = params.auto_image !== false

      const existingImageCount = (params.content?.match(/!\[.*?\]\(.*?\)/g) || []).length

      if (autoImage && existingImageCount < 2) {
        try {
          const result = await this.addImagesToContent(params.content, params.title)
          contentWithImages = result.content
        } catch (imgError: any) {
          console.error('文章配图失败，使用原始内容:', imgError.message || imgError)
        }
      }

      // 4. 创建草稿
      try {
        console.log('正在将图片上传到微信服务器...')
        const wechatContent = await this.replaceImagesForWechat(contentWithImages, accessToken)

        const htmlContent = this.markdownToStyledHtml(wechatContent, params.title)

        const draftData = {
          articles: [{
            title: params.title,
            author: '莫瑞娜AI助手',
            digest: params.digest || this.generateDigest(params.content),
            content: htmlContent,
            thumb_media_id: mediaId,
            need_open_comment: 0,
            only_fans_can_comment: 0
          }]
        }

        const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`
        const draftRes = await fetch(draftUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData)
        })
        const draftResult = await draftRes.json()

        if (draftResult.errcode) {
          const errorMsg = this.getWechatErrorMessage(draftResult.errcode)
          return {
            success: false,
            toolName: this.name,
            error: `创建草稿失败: ${errorMsg}`,
            wechat_error: draftResult
          }
        }

        return {
          success: true,
          toolName: this.name,
          data: {
            article_id: draftResult.media_id,
            title: params.title,
            content: contentWithImages,
            cover_url: usedCoverUrl,
            digest: params.digest || this.generateDigest(params.content),
            message: `公众号文章「${params.title}」已发布到素材库，请在微信公众号后台查看和发布。`,
            next_step: '请在微信公众号后台的素材管理中查看草稿，确认无误后群发。'
          },
          executionTime: Date.now() - startTime
        }
      } catch (draftError: any) {
        return {
          success: false,
          toolName: this.name,
          error: `创建草稿失败: ${draftError.message}`
        }
      }
    } catch (err: any) {
      return {
        success: false,
        toolName: this.name,
        error: `发布失败: ${err.message}`
      }
    }
  }

  private getWechatErrorMessage(errcode: number): string {
    const errorMessages: Record<number, string> = {
      40001: 'AppSecret错误或AppSecret不匹配',
      40002: '不合法的凭证类型',
      40003: '不合法的OpenID',
      40004: '不合法的媒体文件类型',
      40005: '不合法的文件类型',
      40006: '不合法的文件大小',
      40007: '不合法的媒体文件ID',
      40125: '不合法的图片文件大小',
      40126: '不合法的图片分辨率',
      41005: '不合法的图片文件',
      45002: '多媒体文件大小超过限制',
      45003: '多媒体文件内容大小超过限制',
      45004: '多媒体文件内容类型不合法',
      45007: '媒体文件ID不存在',
      45009: '上传图片过大',
      45012: 'media_id不合法'
    }
    return errorMessages[errcode] || `未知错误 (${errcode})`
  }

  private isValidImageUrl(url: string): boolean {
    return !!(url && (url.startsWith('http://') || url.startsWith('https://')) &&
      (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')))
  }

  private async uploadImage(accessToken: string, imageUrl: string): Promise<string> {
    // 下载图片
    const response = await fetch(imageUrl)
    const buffer = Buffer.from(await response.arrayBuffer())

    // 上传到微信服务器
    const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`
    const formData = new FormData()
    formData.append('media', new Blob([buffer]), 'cover.jpg')

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData
    })
    const uploadResult = await uploadRes.json()

    if (uploadResult.errcode) {
      throw new Error(`上传图片失败: ${uploadResult.errmsg}`)
    }

    return uploadResult.media_id
  }

  private async generateCoverImage(title: string): Promise<string | null> {
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)
      const response = await imageClient.generate({
        prompt: `公众号封面图：${title}，简洁大方，文字友好背景，现代设计风格`,
        size: '1K',
        watermark: false
      })
      const helper = imageClient.getResponseHelper(response)
      if (helper.success && helper.imageUrls.length > 0) {
        return helper.imageUrls[0]
      }
    } catch (err) {
      console.error('生成封面图失败:', err)
    }
    return null
  }

  private async generateDefaultCover(title: string): Promise<string | null> {
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)
      const response = await imageClient.generate({
        prompt: `简约纯色封面图，白色背景，${title.substring(0, 10)}，现代设计`,
        size: '1K',
        watermark: false
      })
      const helper = imageClient.getResponseHelper(response)
      if (helper.success && helper.imageUrls.length > 0) {
        return helper.imageUrls[0]
      }
    } catch (err) {
      console.error('生成默认封面失败:', err)
    }
    return null
  }

  private async addImagesToContent(content: string, title: string): Promise<{ content: string }> {
    const paragraphs = content.split('\n\n').filter(p => p.trim())
    if (paragraphs.length === 0) return { content }

    const imagePrompts = [
      `${title}，插图风格，清新简约`,
      `${title}，信息图表风格，现代设计`
    ]

    let imageUrls: string[] = []
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)

      for (const prompt of imagePrompts) {
        try {
          const response = await imageClient.generate({
            prompt: `${prompt}, 4K, high quality`,
            size: '1K',
            watermark: false
          })
          const helper = imageClient.getResponseHelper(response)
          if (helper.success && helper.imageUrls.length > 0) {
            imageUrls.push(helper.imageUrls[0])
          }
        } catch (err) {
          console.error('生成配图失败:', err)
        }
      }
    } catch (err) {
      console.error('添加文章配图失败:', err)
    }

    const result: string[] = []
    for (let i = 0; i < paragraphs.length; i++) {
      result.push(paragraphs[i])

      if (i === 0 && imageUrls[0]) {
        result.push(`![配图1](${imageUrls[0]})`)
      } else if (i === Math.floor(paragraphs.length / 2) && imageUrls[1]) {
        result.push(`![配图2](${imageUrls[1]})`)
      }
    }

    return { content: result.join('\n\n') }
  }

  private async replaceImagesForWechat(content: string, accessToken: string): Promise<string> {
    const imageRegex = /!\[.*?\]\((https?:\/\/[^\)]+)\)/g
    let match
    let replacedContent = content

    while ((match = imageRegex.exec(content)) !== null) {
      const imageUrl = match[1]
      try {
        const mediaId = await this.uploadImage(accessToken, imageUrl)
        replacedContent = replacedContent.replace(imageUrl, `微信图片:${mediaId}`)
      } catch (err) {
        console.error('替换图片失败:', imageUrl, err)
      }
    }

    return replacedContent
  }

  private markdownToStyledHtml(markdown: string, title: string): string {
    // 简化版 Markdown 转 HTML
    let html = markdown
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>')
      .replace(/!\[.*?\]\(https?:\/\/[^\)]+\)/gim, '')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br>')

    return `<p>${html}</p>`
  }

  private generateDigest(content: string): string {
    return content.substring(0, 54).replace(/\n/g, ' ') + '...'
  }
}

/**
 * 发布小红书笔记工具
 */
@Injectable()
export class PublishXiaohongshuTool implements AvatarTool {
  name = 'publish_xiaohongshu'
  displayName = '发布小红书笔记'
  description: '准备发布笔记到小红书。注意：小红书暂无官方开放API，此工具仅用于生成内容，需要用户手动复制发布。'
  category = 'platform_publish' as const

  paramsSchema = {
    title: {
      type: 'string' as const,
      description: '笔记标题',
      required: true
    },
    content: {
      type: 'string' as const,
      description: '笔记内容',
      required: true
    },
    images: {
      type: 'array' as const,
      description: '图片URL列表',
      items: { type: 'string' as const }
    },
    tags: {
      type: 'array' as const,
      description: '话题标签',
      items: { type: 'string' as const }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
      const client = getSupabaseClient()

      const { data: config } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'xiaohongshu')
        .maybeSingle()

      if (!config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['xiaohongshu']
        return {
          success: false,
          toolName: this.name,
          error: '未配置小红书',
          requires_config: true,
          config_platform: 'xiaohongshu',
          config_fields: template.fields
        }
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          title: params.title,
          content: params.content,
          images: params.images,
          tags: params.tags,
          manual_publish_required: true,
          message: `⚠️ 重要提示：小红书暂无官方开放API，无法自动发布。

请按以下步骤手动发布：
1. 打开小红书APP
2. 点击底部的"+"号
3. 选择"图文"
4. 复制下方内容发布

📋 标题：
${params.title}

📝 内容：
${params.content}

${params.tags?.length ? `🏷️ 标签：${params.tags.join(' ')}` : ''}`
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      return {
        success: false,
        toolName: this.name,
        error: `发布失败: ${err.message}`
      }
    }
  }
}

/**
 * 发布微信视频号工具
 */
@Injectable()
export class PublishWechatVideoTool implements AvatarTool {
  name = 'publish_wechat_video'
  displayName = '发布视频号'
  description = '准备发布视频到微信视频号。注意：视频号暂无官方开放API，此工具仅用于生成内容，需要用户手动发布。'
  category = 'platform_publish' as const

  paramsSchema = {
    title: {
      type: 'string' as const,
      description: '视频标题',
      required: true
    },
    video_url: {
      type: 'string' as const,
      description: '视频URL',
      required: true
    },
    cover_url: {
      type: 'string' as const,
      description: '封面URL'
    },
    description: {
      type: 'string' as const,
      description: '视频描述'
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const startTime = Date.now()
      const client = getSupabaseClient()

      const { data: config } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'wechat_video')
        .maybeSingle()

      if (!config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['wechat_video']
        return {
          success: false,
          toolName: this.name,
          error: '未配置微信视频号',
          requires_config: true,
          config_platform: 'wechat_video',
          config_fields: template.fields
        }
      }

      return {
        success: true,
        toolName: this.name,
        data: {
          title: params.title,
          video_url: params.video_url,
          cover_url: params.cover_url,
          description: params.description,
          manual_publish_required: true,
          message: `⚠️ 重要提示：微信视频号暂无官方开放API，无法自动发布。

请按以下步骤手动发布：
1. 打开微信 → 发现 → 视频号
2. 点击右上角"相机"图标
3. 选择"发表视频"
4. 上传视频并填写信息

📋 标题：${params.title}
🎥 视频URL：${params.video_url}${params.description ? `\n📝 描述：${params.description}` : ''}`
        },
        executionTime: Date.now() - startTime
      }
    } catch (err: any) {
      return {
        success: false,
        toolName: this.name,
        error: `发布失败: ${err.message}`
      }
    }
  }
}

// Part 3/3
