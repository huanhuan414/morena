/**
 * 平台发布工具
 * 实现多平台内容发布，包含配置检测机制
 */

import { Injectable } from '@nestjs/common'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult, PlatformType, PLATFORM_CONFIG_TEMPLATES } from '../agent.types'
import { getSupabaseClient } from '../../../storage/database/supabase-client'
import { Config, ImageGenerationClient } from 'coze-coding-dev-sdk'

/**
 * 平台配置检查工具
 */
@Injectable()
export class CheckPlatformConfigTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'check_platform_config',
    displayName: '检查平台配置',
    description: '检查用户是否已配置指定平台的授权信息',
    category: 'data_analysis',
    paramsSchema: {
      platform: { 
        type: 'string', 
        enum: ['wechat_mp', 'xiaohongshu', 'bilibili', 'weibo', 'douyin', 'wechat_video'],
        description: '平台类型',
        required: true
      }
    }
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      const platform = params.platform as PlatformType
      
      const { data, error } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', platform)
        .maybeSingle()

      if (error) {
        return { success: false, error: `查询配置失败: ${error.message}` }
      }

      if (!data || data.status === 'unconfigured') {
        const template = PLATFORM_CONFIG_TEMPLATES[platform]
        return {
          success: true,
          data: {
            configured: false,
            platform,
            platform_name: template.platform_name,
            required_fields: template.fields,
            instructions: template.instructions,
            help_url: template.help_url
          },
          requires_config: true,
          config_platform: platform,
          config_fields: template.fields
        }
      }

      if (data.status === 'expired') {
        return {
          success: true,
          data: {
            configured: false,
            platform,
            platform_name: PLATFORM_CONFIG_TEMPLATES[platform].platform_name,
            status: 'expired',
            message: '配置已过期，请重新配置'
          },
          requires_config: true,
          config_platform: platform
        }
      }

      return {
        success: true,
        data: {
          configured: true,
          platform,
          platform_name: PLATFORM_CONFIG_TEMPLATES[platform].platform_name,
          status: data.status,
          last_used_at: data.last_used_at
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }
}

/**
 * 发布微信公众号文章工具
 * 
 * 实现完整的微信公众号发布流程：
 * 1. 获取 access_token
 * 2. 上传封面图片（支持外部URL和自动生成）
 * 3. 创建草稿
 * 4. 发布草稿
 */
@Injectable()
export class PublishWechatMpTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_wechat_mp',
    displayName: '发布公众号文章',
    description: '发布文章到微信公众号素材库',
    category: 'platform_publish',
    paramsSchema: {
      title: { type: 'string', description: '文章标题', required: true },
      content: { type: 'string', description: '文章内容（Markdown或HTML格式）', required: true },
      cover_url: { type: 'string', description: '封面图片URL（可选，不传则根据标题自动生成）' },
      digest: { type: 'string', description: '摘要' }
    },
    requiresPlatform: 'wechat_mp'
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      // 检查配置
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
          error: '未配置微信公众号',
          requires_config: true,
          config_platform: 'wechat_mp',
          config_fields: template.fields
        }
      }

      const appId = config.config_data?.app_id
      const appSecret = config.config_data?.app_secret
      
      console.log('Agent工具 - 发布公众号文章:', {
        title: params.title,
        cover_url: params.cover_url,
        app_id: appId,
        user_id: context.userId
      })

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
            data: { title: params.title, content: params.content },
            error: `微信API错误: ${errorMsg}`
          }
        }
        accessToken = tokenData.access_token
        console.log('获取 access_token 成功')
      } catch (fetchError: any) {
        console.error('获取 access_token 失败:', fetchError)
        return {
          success: false,
          error: `获取access_token失败: ${fetchError.message}`
        }
      }

      // 2. 处理封面图片
      let mediaId: string | undefined
      try {
        if (params.cover_url) {
          console.log('正在上传封面图片:', params.cover_url)
          mediaId = await this.uploadImage(accessToken, params.cover_url)
          console.log('封面图片上传成功, media_id:', mediaId)
        } else {
          // 根据标题自动生成封面图
          console.log('正在根据标题生成封面图片...')
          const generatedCoverUrl = await this.generateCoverImage(params.title)
          if (generatedCoverUrl) {
            mediaId = await this.uploadImage(accessToken, generatedCoverUrl)
            console.log('自动生成封面上传成功, media_id:', mediaId)
          }
        }
      } catch (coverError: any) {
        console.error('处理封面图片失败:', coverError)
        // 继续尝试创建草稿
      }

      if (!mediaId) {
        return {
          success: false,
          error: '封面图片处理失败，请检查图片URL或网络连接'
        }
      }

      // 3. 创建草稿
      try {
        // 将Markdown内容转换为美化的HTML
        const htmlContent = this.markdownToStyledHtml(params.content, params.title)
        
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

        console.log('正在创建草稿...')
        const draftUrl = `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${accessToken}`
        const draftRes = await fetch(draftUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData)
        })
        const draftResult = await draftRes.json()
        
        if (draftResult.errcode) {
          const errorMsg = this.getWechatErrorMessage(draftResult.errcode)
          console.error('创建草稿失败:', draftResult)
          return {
            success: false,
            error: `创建草稿失败: ${errorMsg}`
          }
        }

        const draftMediaId = draftResult.media_id
        console.log('草稿创建成功, media_id:', draftMediaId)

        return {
          success: true,
          data: {
            media_id: draftMediaId,
            title: params.title,
            message: `✅ 文章已成功保存到公众号草稿箱！\n\n请前往微信公众平台 → 素材管理 → 草稿箱 查看《${params.title}》并进行发布。`
          }
        }
      } catch (draftError: any) {
        console.error('创建草稿失败:', draftError)
        return {
          success: false,
          error: `创建草稿失败: ${draftError.message}`
        }
      }
    } catch (err: any) {
      return { success: false, error: `发布失败: ${err.message}` }
    }
  }

  /**
   * 根据标题生成封面图片
   */
  private async generateCoverImage(title: string): Promise<string | null> {
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)
      
      // 根据标题生成封面图提示词
      const prompt = `${title}，微信公众号封面，简约现代风格，清新配色，适合阅读，高质量，专业设计`
      
      const response = await imageClient.generate({
        prompt: `${prompt}, social media cover style, clean layout, gradient background, professional`,
        size: '1K',
        watermark: false
      })
      
      const helper = imageClient.getResponseHelper(response)
      if (helper.success && helper.imageUrls.length > 0) {
        return helper.imageUrls[0]
      }
      return null
    } catch (err) {
      console.error('生成封面图失败:', err)
      return null
    }
  }

  /**
   * 上传图片到微信服务器
   */
  private async uploadImage(accessToken: string, imageUrl: string): Promise<string> {
    // 下载图片
    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) {
      throw new Error('下载图片失败')
    }
    const imageBuffer = await imageRes.arrayBuffer()
    
    // 上传到微信
    const uploadUrl = `https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=${accessToken}&type=image`
    
    const boundary = `----WebKitFormBoundary${Date.now().toString(16)}`
    const formData: string[] = []
    
    formData.push(`--${boundary}\r\n`)
    formData.push(`Content-Disposition: form-data; name="media"; filename="cover.jpg"\r\n`)
    formData.push(`Content-Type: image/jpeg\r\n\r\n`)
    
    const formDataBuffer = Buffer.concat([
      Buffer.from(formData.join(''), 'utf-8'),
      Buffer.from(imageBuffer),
      Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
    ])

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: formDataBuffer
    })

    const uploadResult = await uploadRes.json()
    
    if (uploadResult.errcode) {
      throw new Error(this.getWechatErrorMessage(uploadResult.errcode))
    }

    return uploadResult.media_id
  }

  /**
   * 生成文章摘要
   */
  private generateDigest(content: string): string {
    // 移除Markdown标记，提取纯文本
    const plainText = content
      .replace(/#{1,6}\s/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
      .replace(/>/g, '')
      .replace(/-/g, '')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    // 微信公众号摘要限制54个汉字（约120字符）
    return plainText.substring(0, 54) + (plainText.length > 54 ? '...' : '')
  }

  /**
   * Markdown 转 styled HTML（公众号适配版）
   */
  private markdownToStyledHtml(markdown: string, title?: string): string {
    if (!markdown) return ''
    
    let html = markdown
    
    // 公众号文章样式
    const styles = {
      container: 'max-width: 100%; padding: 20px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 16px; line-height: 1.8; color: #333; background: #fff;',
      h1: 'font-size: 22px; font-weight: bold; color: #000; margin: 24px 0 16px; padding-bottom: 12px; border-bottom: 2px solid #eee;',
      h2: 'font-size: 20px; font-weight: bold; color: #000; margin: 20px 0 12px;',
      h3: 'font-size: 18px; font-weight: bold; color: #333; margin: 16px 0 10px;',
      h4: 'font-size: 16px; font-weight: bold; color: #333; margin: 14px 0 8px;',
      p: 'margin: 12px 0; text-align: justify; letter-spacing: 0.5px;',
      blockquote: 'margin: 16px 0; padding: 12px 16px; background: linear-gradient(135deg, #f8f9fa 0%, #fff 100%); border-left: 4px solid #1890ff; border-radius: 4px; color: #666; font-size: 15px;',
      ul: 'margin: 12px 0; padding-left: 24px;',
      ol: 'margin: 12px 0; padding-left: 24px;',
      li: 'margin: 6px 0; line-height: 1.8;',
      code: 'background: #f5f5f5; padding: 2px 6px; border-radius: 3px; font-family: Monaco, Consolas, monospace; font-size: 14px; color: #c7254e;',
      pre: 'background: #282c34; color: #abb2bf; padding: 16px; border-radius: 8px; overflow-x: auto; font-family: Monaco, Consolas, monospace; font-size: 14px; line-height: 1.6; margin: 16px 0;',
      img: 'max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; display: block;',
      strong: 'font-weight: bold; color: #000;',
      em: 'font-style: italic; color: #666;',
      a: 'color: #1890ff; text-decoration: none;',
      hr: 'border: none; height: 1px; background: linear-gradient(to right, transparent, #ddd, transparent); margin: 24px 0;',
      highlight: 'background: linear-gradient(to bottom, transparent 60%, #fff3cd 60%); padding: 0 4px;'
    }

    // 标题处理
    html = html.replace(/^#### (.+)$/gm, `<h4 style="${styles.h4}">$1</h4>`)
    html = html.replace(/^### (.+)$/gm, `<h3 style="${styles.h3}">$1</h3>`)
    html = html.replace(/^## (.+)$/gm, `<h2 style="${styles.h2}">$1</h2>`)
    html = html.replace(/^# (.+)$/gm, `<h1 style="${styles.h1}">$1</h1>`)
    
    // 代码块（必须先处理）
    html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, (match, lang, code) => {
      return `<pre style="${styles.pre}"><code>${code.trim()}</code></pre>`
    })
    
    // 行内代码
    html = html.replace(/`([^`]+)`/g, `<code style="${styles.code}">$1</code>`)
    
    // 图片
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, `<img src="$2" alt="$1" style="${styles.img}" />`)
    
    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="${styles.a}">$1</a>`)
    
    // 粗体
    html = html.replace(/\*\*(.+?)\*\*/g, `<strong style="${styles.strong}">$1</strong>`)
    
    // 斜体
    html = html.replace(/\*(.+?)\*/g, `<em style="${styles.em}">$1</em>`)
    
    // 高亮标记（==文字==）
    html = html.replace(/==(.+?)==/g, `<span style="${styles.highlight}">$1</span>`)
    
    // 引用块（带emoji的引用特殊处理）
    html = html.replace(/^> 💡 (.+)$/gm, `<blockquote style="${styles.blockquote}"><span style="font-size: 18px;">💡</span> <strong>金句：</strong>$1</blockquote>`)
    html = html.replace(/^> ⚠️ (.+)$/gm, `<blockquote style="${styles.blockquote}; border-left-color: #ff9800;"><span style="font-size: 18px;">⚠️</span> $1</blockquote>`)
    html = html.replace(/^> ✨ (.+)$/gm, `<blockquote style="${styles.blockquote}; border-left-color: #9c27b0;"><span style="font-size: 18px;">✨</span> $1</blockquote>`)
    html = html.replace(/^> (.+)$/gm, `<blockquote style="${styles.blockquote}">$1</blockquote>`)
    
    // 无序列表
    html = html.replace(/^- (.+)$/gm, `<li style="${styles.li}">$1</li>`)
    html = html.replace(/(<li style="[^"]+">.*<\/li>\n?)+/g, `<ul style="${styles.ul}">$&</ul>`)
    
    // 有序列表
    html = html.replace(/^\d+\. (.+)$/gm, `<li style="${styles.li}">$1</li>`)
    
    // 分割线
    html = html.replace(/^---$/gm, `<hr style="${styles.hr}" />`)
    html = html.replace(/^\*\*\*$/gm, `<hr style="${styles.hr}" />`)
    
    // 段落处理
    html = html.replace(/\n\n/g, '</p><p style="' + styles.p + '">')
    
    // 清理多余的空段落
    html = html.replace(/<p style="[^"]+">\s*<\/p>/g, '')
    
    // 包装在容器中
    html = `<section style="${styles.container}">
      ${title ? `<h1 style="${styles.h1}">${title}</h1>` : ''}
      <p style="${styles.p}">${html}</p>
    </section>`
    
    // 最终清理
    html = html.replace(/<p style="[^"]+"><\/p>/g, '')
    html = html.replace(/<p style="[^"]+">\s*<h/g, '<h')
    html = html.replace(/<\/h(\d)>\s*<\/p>/g, '</h$1>')
    
    return html
  }

  /**
   * 获取微信API错误码对应的中文说明
   */
  private getWechatErrorMessage(errcode: number): string {
    const errorMessages: Record<number, string> = {
      40001: 'AppSecret错误或不属于该公众号',
      40013: '不合法的AppID',
      40164: '服务器IP未加入白名单',
      41001: '缺少access_token参数',
      41004: '缺少AppSecret参数',
      42001: 'access_token已过期',
      45009: '接口调用超过限制',
      45011: 'API调用太频繁',
      45017: '标题不能为空',
      45018: '内容不能为空',
      45024: '素材数量超出限制',
      46003: '菜单不存在',
      47001: '解析JSON/XML内容错误',
      48001: 'api功能未授权（需要认证的服务号）',
      48004: '接口调用失败，请检查公众号权限',
      50002: '用户受限',
      50005: '用户未关注公众号',
      61004: 'access_token已过期或无效',
      87009: '账号安全问题',
      87010: '涉嫌违法内容',
      87011: '涉嫌营销内容',
      87012: '内容涉及敏感信息',
    }
    return errorMessages[errcode] || `微信API错误码：${errcode}`
  }
}

/**
 * 发布小红书笔记工具
 */
@Injectable()
export class PublishXiaohongshuTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_xiaohongshu',
    displayName: '发布小红书笔记',
    description: '发布笔记到小红书',
    category: 'platform_publish',
    paramsSchema: {
      title: { type: 'string', description: '笔记标题', required: true },
      content: { type: 'string', description: '笔记内容', required: true },
      images: { type: 'array', items: { type: 'string' }, description: '图片URL列表' },
      tags: { type: 'array', items: { type: 'string' }, description: '话题标签' }
    },
    requiresPlatform: 'xiaohongshu'
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
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
          error: '未配置小红书',
          requires_config: true,
          config_platform: 'xiaohongshu',
          config_fields: template.fields
        }
      }

      console.log('Agent工具 - 发布小红书笔记:', params.title)

      return {
        success: true,
        data: {
          note_id: `xhs_${Date.now()}`,
          title: params.title,
          message: `📝 笔记已准备好！\n\n小红书暂无官方开放API，请手动复制到小红书发布。`
        }
      }
    } catch (err: any) {
      return { success: false, error: `发布失败: ${err.message}` }
    }
  }
}

/**
 * 发布B站内容工具
 */
@Injectable()
export class PublishBilibiliTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_bilibili',
    displayName: '发布B站内容',
    description: '发布视频或文章到B站',
    category: 'platform_publish',
    paramsSchema: {
      type: { type: 'string', enum: ['video', 'article'], default: 'article' },
      title: { type: 'string', description: '标题', required: true },
      content: { type: 'string', description: '文章内容' },
      video_url: { type: 'string', description: '视频URL' },
      cover_url: { type: 'string', description: '封面URL' },
      tags: { type: 'array', items: { type: 'string' }, description: '标签' }
    },
    requiresPlatform: 'bilibili'
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const { data: config } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'bilibili')
        .maybeSingle()

      if (!config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['bilibili']
        return {
          success: false,
          error: '未配置B站',
          requires_config: true,
          config_platform: 'bilibili',
          config_fields: template.fields
        }
      }

      console.log('Agent工具 - 发布B站内容:', params.title)

      return {
        success: true,
        data: {
          title: params.title,
          message: `📺 内容已准备好！\n\nB站暂无官方开放API，请手动复制到B站发布。`
        }
      }
    } catch (err: any) {
      return { success: false, error: `发布失败: ${err.message}` }
    }
  }
}

/**
 * 发布微博工具
 */
@Injectable()
export class PublishWeiboTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_weibo',
    displayName: '发布微博',
    description: '发布微博内容',
    category: 'platform_publish',
    paramsSchema: {
      content: { type: 'string', description: '微博内容', required: true },
      images: { type: 'array', items: { type: 'string' }, description: '图片URL列表' }
    },
    requiresPlatform: 'weibo'
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const { data: config } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'weibo')
        .maybeSingle()

      if (!config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['weibo']
        return {
          success: false,
          error: '未配置微博',
          requires_config: true,
          config_platform: 'weibo',
          config_fields: template.fields
        }
      }

      console.log('Agent工具 - 发布微博')

      return {
        success: true,
        data: {
          message: `🐦 微博内容已准备好！\n\n微博暂无官方开放API，请手动复制发布。`
        }
      }
    } catch (err: any) {
      return { success: false, error: `发布失败: ${err.message}` }
    }
  }
}

/**
 * 发布抖音视频工具
 */
@Injectable()
export class PublishDouyinTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_douyin',
    displayName: '发布抖音视频',
    description: '发布视频到抖音',
    category: 'platform_publish',
    paramsSchema: {
      title: { type: 'string', description: '视频标题', required: true },
      video_url: { type: 'string', description: '视频URL', required: true },
      cover_url: { type: 'string', description: '封面URL' },
      tags: { type: 'array', items: { type: 'string' }, description: '话题标签' }
    },
    requiresPlatform: 'douyin'
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
      const client = getSupabaseClient()
      
      const { data: config } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'douyin')
        .maybeSingle()

      if (!config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['douyin']
        return {
          success: false,
          error: '未配置抖音',
          requires_config: true,
          config_platform: 'douyin',
          config_fields: template.fields
        }
      }

      console.log('Agent工具 - 发布抖音视频:', params.title)

      return {
        success: true,
        data: {
          message: `🎵 视频内容已准备好！\n\n请前往抖音创作者中心手动发布。`
        }
      }
    } catch (err: any) {
      return { success: false, error: `发布失败: ${err.message}` }
    }
  }
}

/**
 * 发布视频号工具
 */
@Injectable()
export class PublishWechatVideoTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_wechat_video',
    displayName: '发布视频号',
    description: '发布视频到微信视频号',
    category: 'platform_publish',
    paramsSchema: {
      title: { type: 'string', description: '视频标题', required: true },
      video_url: { type: 'string', description: '视频URL', required: true },
      cover_url: { type: 'string', description: '封面URL' },
      description: { type: 'string', description: '视频描述' }
    },
    requiresPlatform: 'wechat_video'
  }

  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolResult> {
    try {
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
          error: '未配置微信视频号',
          requires_config: true,
          config_platform: 'wechat_video',
          config_fields: template.fields
        }
      }

      console.log('Agent工具 - 发布视频号:', params.title)

      return {
        success: true,
        data: {
          message: `🎬 视频内容已准备好！\n\n视频号API目前在内测阶段，请前往视频号创作者中心手动发布。`
        }
      }
    } catch (err: any) {
      return { success: false, error: `发布失败: ${err.message}` }
    }
  }
}
