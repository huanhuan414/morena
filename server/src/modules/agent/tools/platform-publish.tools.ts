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
 * 3. 根据文章内容自动生成配图
 * 4. 创建草稿
 * 5. 发布草稿
 */
@Injectable()
export class PublishWechatMpTool implements ITool {
  readonly definition: ToolDefinition = {
    name: 'publish_wechat_mp',
    displayName: '发布公众号文章',
    description: '发布文章到微信公众号素材库，支持根据内容自动配图',
    category: 'platform_publish',
    paramsSchema: {
      title: { type: 'string', description: '文章标题', required: true },
      content: { type: 'string', description: '文章内容（Markdown或HTML格式）', required: true },
      cover_url: { type: 'string', description: '封面图片URL（可选，不传则根据标题自动生成）' },
      digest: { type: 'string', description: '摘要' },
      auto_image: { type: 'boolean', description: '是否自动配图（默认true）' }
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
        user_id: context.userId,
        content_length: params.content?.length || 0,
        content_preview: params.content?.substring(0, 200)
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
        if (params.cover_url && this.isValidImageUrl(params.cover_url)) {
          console.log('正在上传封面图片:', params.cover_url)
          mediaId = await this.uploadImage(accessToken, params.cover_url)
          console.log('封面图片上传成功, media_id:', mediaId)
        }
        
        // 如果没有封面图片或上传失败，根据标题自动生成
        if (!mediaId) {
          console.log('正在根据标题生成封面图片...')
          const generatedCoverUrl = await this.generateCoverImage(params.title)
          if (generatedCoverUrl) {
            mediaId = await this.uploadImage(accessToken, generatedCoverUrl)
            console.log('自动生成封面上传成功, media_id:', mediaId)
          }
        }
      } catch (coverError: any) {
        console.error('处理封面图片失败:', coverError.message || coverError)
        // 继续尝试生成默认封面
      }

      // 最终尝试：生成一个简单的默认封面
      if (!mediaId) {
        try {
          console.log('生成默认封面作为最终备选...')
          const defaultCoverUrl = await this.generateDefaultCover(params.title)
          if (defaultCoverUrl) {
            mediaId = await this.uploadImage(accessToken, defaultCoverUrl)
            console.log('默认封面上传成功, media_id:', mediaId)
          }
        } catch (finalError: any) {
          console.error('生成默认封面也失败:', finalError.message || finalError)
        }
      }

      if (!mediaId) {
        return {
          success: false,
          error: '封面图片处理失败，无法创建草稿。请稍后重试或联系技术支持。'
        }
      }

      // 3. 根据文章内容生成配图
      let contentWithImages = params.content
      const autoImage = params.auto_image !== false // 默认开启自动配图
      
      if (autoImage) {
        try {
          console.log('正在分析文章内容，生成配图...')
          console.log('原始内容长度:', params.content?.length)
          contentWithImages = await this.addImagesToContent(params.content, params.title)
          console.log('文章配图完成，配图后内容长度:', contentWithImages?.length)
          console.log('配图后内容预览:', contentWithImages?.substring(0, 500))
        } catch (imgError: any) {
          console.error('文章配图失败，使用原始内容:', imgError.message || imgError)
          // 配图失败不影响发布，使用原始内容
        }
      }

      // 4. 创建草稿
      try {
        // 将Markdown内容转换为美化的HTML
        const htmlContent = this.markdownToStyledHtml(contentWithImages, params.title)
        console.log('HTML内容长度:', htmlContent?.length)
        console.log('HTML内容预览:', htmlContent?.substring(0, 500))
        
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
   * 检查URL是否是有效的图片URL
   * 排除假URL和占位符URL
   */
  private isValidImageUrl(url: string): boolean {
    if (!url) return false
    
    // 排除常见的占位符和假URL
    const invalidPatterns = [
      'example.com',
      'placeholder.com',
      'via.placeholder.com',
      'dummyimage.com',
      'placehold.it',
      'lorempixel.com',
      'fake',
      'test-url',
    ]
    
    const lowerUrl = url.toLowerCase()
    for (const pattern of invalidPatterns) {
      if (lowerUrl.includes(pattern)) {
        console.log(`检测到无效的封面URL: ${url}`)
        return false
      }
    }
    
    // 检查是否是有效的URL格式
    try {
      new URL(url)
      return true
    } catch {
      return false
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
   * 生成默认封面（使用公开图片服务）
   */
  private async generateDefaultCover(title: string): Promise<string | null> {
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)
      
      // 使用简单的提示词生成一个通用封面
      const response = await imageClient.generate({
        prompt: 'Abstract modern gradient background, blue and white colors, minimalist design, professional business style, no text, clean composition',
        size: '1K',
        watermark: false
      })
      
      const helper = imageClient.getResponseHelper(response)
      if (helper.success && helper.imageUrls.length > 0) {
        return helper.imageUrls[0]
      }
      return null
    } catch (err) {
      console.error('生成默认封面失败:', err)
      return null
    }
  }

  /**
   * 根据文章内容自动添加配图
   * 在文章开头和每个主要章节后插入配图
   */
  private async addImagesToContent(content: string, title: string): Promise<string> {
    try {
      const config = new Config()
      const imageClient = new ImageGenerationClient(config)
      
      // 1. 生成文章开头配图
      console.log('生成文章开头配图...')
      const introImagePrompt = this.generateImagePrompt(title, 'intro')
      const introImageResponse = await imageClient.generate({
        prompt: introImagePrompt,
        size: '1K',
        watermark: false
      })
      const introHelper = imageClient.getResponseHelper(introImageResponse)
      const introImageUrl = introHelper.success && introHelper.imageUrls.length > 0 
        ? introHelper.imageUrls[0] 
        : null

      // 2. 分析文章结构，找到所有 h2 标题
      const sections = this.parseArticleSections(content)
      console.log(`文章共发现 ${sections.length} 个章节`)
      
      // 3. 为每个章节生成配图（最多3张）
      const sectionImages: { position: number; url: string }[] = []
      const maxImages = Math.min(sections.length, 3)
      
      for (let i = 0; i < maxImages; i++) {
        const section = sections[i]
        console.log(`生成章节 ${i + 1} 配图: ${section.title}`)
        
        try {
          const sectionPrompt = this.generateImagePrompt(section.title, 'section', title)
          const sectionResponse = await imageClient.generate({
            prompt: sectionPrompt,
            size: '1K',
            watermark: false
          })
          const sectionHelper = imageClient.getResponseHelper(sectionResponse)
          
          if (sectionHelper.success && sectionHelper.imageUrls.length > 0) {
            sectionImages.push({
              position: section.position,
              url: sectionHelper.imageUrls[0]
            })
            // 每张图生成间隔一下，避免频率限制
            await new Promise(resolve => setTimeout(resolve, 500))
          }
        } catch (sectionErr) {
          console.error(`章节 ${i + 1} 配图生成失败:`, sectionErr)
        }
      }

      // 4. 将图片插入到文章中
      let result = content
      
      // 在开头插入配图
      if (introImageUrl) {
        console.log('✅ 开头配图生成成功，插入到文章开头')
        result = `![${title}](${introImageUrl})\n\n${result}`
      } else {
        console.log('❌ 开头配图生成失败')
      }
      
      // 在章节后插入配图（从后往前插入，避免位置偏移）
      for (let i = sectionImages.length - 1; i >= 0; i--) {
        const { position, url } = sectionImages[i]
        const section = sections.find(s => s.position === position)
        if (section) {
          // 在章节内容后插入图片
          const insertPosition = this.findInsertPosition(result, section)
          console.log(`插入章节配图: 位置=${insertPosition}, 标题=${section.title}`)
          if (insertPosition !== -1) {
            const before = result.substring(0, insertPosition)
            const after = result.substring(insertPosition)
            const imageMarkdown = `\n\n![${section.title}](${url})\n`
            result = before + imageMarkdown + after
            console.log('✅ 章节配图插入成功')
          }
        }
      }

      console.log('配图完成，最终内容长度:', result.length)
      return result
    } catch (err) {
      console.error('添加配图失败:', err)
      return content // 失败时返回原始内容
    }
  }

  /**
   * 解析文章章节，提取标题及其位置
   * 支持 h2、h3、h4 标题，以及按段落分割
   */
  private parseArticleSections(content: string): { title: string; position: number; content: string }[] {
    const sections: { title: string; position: number; content: string }[] = []
    const lines = content.split('\n')
    let currentPosition = 0
    
    // 1. 先尝试找 h2/h3/h4 标题
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineLength = line.length + 1 // +1 for newline
      
      // 匹配 h2 标题 (## 标题)
      const h2Match = line.match(/^##\s+(.+)$/)
      if (h2Match) {
        sections.push({
          title: h2Match[1].trim(),
          position: currentPosition,
          content: line
        })
      }
      
      // 匹配 h3 标题 (### 标题)
      const h3Match = line.match(/^###\s+(.+)$/)
      if (h3Match) {
        sections.push({
          title: h3Match[1].trim(),
          position: currentPosition,
          content: line
        })
      }
      
      // 匹配 h4 标题 (#### 标题)
      const h4Match = line.match(/^####\s+(.+)$/)
      if (h4Match) {
        sections.push({
          title: h4Match[1].trim(),
          position: currentPosition,
          content: line
        })
      }
      
      currentPosition += lineLength
    }
    
    // 2. 如果没有找到任何标题，按段落分割
    if (sections.length === 0) {
      console.log('未发现标题格式，按段落分割生成配图...')
      const paragraphs = content.split(/\n\n+/)
      let pos = 0
      
      // 取前3个非空段落
      const validParagraphs = paragraphs.filter(p => p.trim().length > 20)
      for (let i = 0; i < Math.min(validParagraphs.length, 3); i++) {
        const p = validParagraphs[i]
        // 从段落中提取前30个字符作为"标题"
        const pseudoTitle = p.replace(/[#*`>\-\n]/g, '').trim().substring(0, 30)
        
        sections.push({
          title: pseudoTitle + (p.length > 30 ? '...' : ''),
          position: pos,
          content: p
        })
        
        pos += p.length + 2 // +2 for \n\n
      }
    }
    
    return sections
  }

  /**
   * 找到章节内容后的插入位置（章节内容结束后的第一个空行）
   */
  private findInsertPosition(content: string, section: { title: string; position: number; content: string }): number {
    // 找到章节标题所在位置
    const sectionIndex = content.indexOf(section.content, section.position)
    if (sectionIndex === -1) {
      // 如果找不到精确匹配，尝试在内容中找到段落结束位置
      const paragraphEnd = content.indexOf('\n\n', section.position)
      return paragraphEnd !== -1 ? paragraphEnd : content.length
    }
    
    // 从章节标题位置开始，找到段落结束位置
    let pos = sectionIndex + section.content.length
    
    // 跳过当前行剩余内容
    const nextNewline = content.indexOf('\n', pos)
    if (nextNewline !== -1) {
      pos = nextNewline + 1
    }
    
    // 找到下一个空行（段落结束）
    while (pos < content.length) {
      if (content[pos] === '\n') {
        // 找到空行
        if (pos + 1 < content.length && content[pos + 1] === '\n') {
          return pos
        }
        // 或者遇到下一个标题
        const remaining = content.substring(pos + 1)
        if (remaining.match(/^(#{1,6}\s)/)) {
          return pos
        }
      }
      pos++
    }
    
    // 如果没找到合适位置，在文件末尾插入
    return content.length
  }

  /**
   * 根据内容生成图片提示词
   */
  private generateImagePrompt(content: string, type: 'intro' | 'section', mainTitle?: string): string {
    // 清理内容，提取关键词
    const cleanContent = content
      .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '')
      .substring(0, 100)
    
    if (type === 'intro') {
      return `${cleanContent}，微信公众号文章配图，精美插画风格，现代简约，清新配色，高质量，专业设计，无文字，artistic illustration, clean composition, gradient colors`
    } else {
      return `${cleanContent}，文章插图，简约插画风格，与"${mainTitle || ''}"主题相关，清新配色，高质量，无文字，thematic illustration, clean style, professional design`
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
