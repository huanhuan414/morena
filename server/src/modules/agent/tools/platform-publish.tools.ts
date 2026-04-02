/**
 * 平台发布工具
 * 实现多平台内容发布，包含配置检测机制
 */

import { Injectable } from '@nestjs/common'
import { ITool, ToolContext, ToolDefinition } from './tool.interface'
import { ToolResult, PlatformType, PLATFORM_CONFIG_TEMPLATES } from '../agent.types'
import { getSupabaseClient } from '../../../storage/database/supabase-client'

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
 * 实现真正的微信公众号发布流程：
 * 1. 获取 access_token
 * 2. 上传封面图片（如果有）
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
      content: { type: 'string', description: '文章内容（HTML格式）', required: true },
      cover_url: { type: 'string', description: '封面图片URL' },
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
            data: {
              title: params.title,
              content: params.content,
              cover_url: params.cover_url
            },
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

      // 2. 上传封面图片（必须有封面才能创建草稿）
      let mediaId: string | undefined
      if (params.cover_url) {
        try {
          console.log('正在上传封面图片:', params.cover_url)
          mediaId = await this.uploadImage(accessToken, params.cover_url)
          console.log('封面图片上传成功, media_id:', mediaId)
        } catch (uploadError: any) {
          console.error('上传封面图片失败:', uploadError)
        }
      }
      
      // 如果没有封面图片，生成一个默认封面
      if (!mediaId) {
        try {
          console.log('正在生成默认封面图片...')
          mediaId = await this.generateDefaultCover(accessToken, params.title)
          console.log('默认封面生成成功, media_id:', mediaId)
        } catch (genError: any) {
          console.error('生成默认封面失败:', genError)
          return {
            success: false,
            error: '需要封面图片才能发布文章，请先生成封面图片或提供封面URL'
          }
        }
      }

      // 3. 创建草稿
      try {
        // 将Markdown内容转换为HTML（简单转换）
        const htmlContent = this.markdownToHtml(params.content)
        
        const draftData = {
          articles: [{
            title: params.title,
            author: '莫瑞娜AI助手',
            digest: params.digest || params.content.substring(0, 120),
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

        // 4. 发布草稿（可选，需要用户确认）
        // 发布接口需要更高的权限，这里先返回草稿链接让用户手动发布
        return {
          success: true,
          data: {
            media_id: draftMediaId,
            title: params.title,
            message: `✅ 文章已成功保存到公众号草稿箱！\n\n请前往微信公众平台 → 素材管理 → 草稿箱 查看《${params.title}》并进行发布。\n\n提示：如需自动发布，请在公众号后台开通「发布能力」接口权限。`
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
    
    // 构建 multipart/form-data
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
   * 生成默认封面图片并上传
   * 创建一个简单的渐变色封面图片
   */
  private async generateDefaultCover(accessToken: string, title: string): Promise<string> {
    // 创建一个简单的PNG图片 (900x383 是微信公众号推荐封面尺寸)
    // 使用纯色背景 + 文字的简单图片
    const width = 900
    const height = 383
    
    // 生成一个简单的PNG文件（最简单的1x1像素PNG，然后微信会处理）
    // 实际上我们用一个预设的在线封面图片
    const defaultCoverUrl = 'https://picsum.photos/900/383'
    
    try {
      // 下载默认封面
      const imageRes = await fetch(defaultCoverUrl)
      if (!imageRes.ok) {
        throw new Error('下载默认封面失败')
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
    } catch (err: any) {
      console.error('生成默认封面失败:', err)
      throw err
    }
  }

  /**
   * 简单的 Markdown 转 HTML
   */
  private markdownToHtml(markdown: string): string {
    if (!markdown) return ''
    
    let html = markdown
    
    // 标题
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>')
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>')
    
    // 粗体
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    
    // 斜体
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
    
    // 链接
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    
    // 图片
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;" />')
    
    // 代码块
    html = html.replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>')
    
    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
    
    // 列表
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>')
    html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    
    // 引用
    html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    
    // 段落
    html = html.replace(/\n\n/g, '</p><p>')
    html = `<p>${html}</p>`
    
    // 清理空段落
    html = html.replace(/<p>\s*<\/p>/g, '')
    
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
      
      const { data: config, error: configError } = await client
        .from('platform_configs')
        .select('*')
        .eq('user_id', context.userId)
        .eq('platform_type', 'xiaohongshu')
        .maybeSingle()

      if (configError || !config || config.status !== 'active') {
        const template = PLATFORM_CONFIG_TEMPLATES['xiaohongshu']
        return {
          success: false,
          error: '未配置小红书',
          requires_config: true,
          config_platform: 'xiaohongshu',
          config_fields: template.fields
        }
      }

      console.log('Agent工具 - 发布小红书笔记:', {
        title: params.title,
        user_id: context.userId
      })

      // TODO: 实现真实的小红书API调用
      // 小红书没有官方开放API，需要使用Cookie模拟登录
      
      return {
        success: true,
        data: {
          note_id: `xhs_${Date.now()}`,
          title: params.title,
          message: `📝 笔记已准备好！\n\n小红书暂无官方开放API，请手动复制以下内容到小红书发布：\n\n标题：${params.title}\n内容：${params.content?.substring(0, 200)}...`
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

      // TODO: 实现真实的B站API调用
      
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

      console.log('Agent工具 - 发布微博:', params.content?.substring(0, 50))

      // TODO: 实现真实的微博API调用
      
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

      // TODO: 实现真实的抖音API调用
      
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

      // TODO: 实现真实的视频号API调用
      
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
