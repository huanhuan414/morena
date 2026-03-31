import { Injectable } from '@nestjs/common'
import { LLMClient, Config, ImageGenerationClient, VideoGenerationClient, HeaderUtils } from 'coze-coding-dev-sdk'
import { S3Storage } from 'coze-coding-dev-sdk'
import { getSupabaseClient } from '../../storage/database/supabase-client'

@Injectable()
export class AvatarService {
  private storage: S3Storage

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: '',
      secretKey: '',
      bucketName: process.env.COZE_BUCKET_NAME,
      region: 'cn-beijing',
    })
  }

  async createAvatar(userId: string, avatarData: Record<string, any>) {
    const client = getSupabaseClient()
    
    // 从图片分析结果构建分身配置
    const photoAnalysis = avatarData.photo_analysis || {}
    
    const { data, error } = await client
      .from('avatars')
      .insert({
        user_id: userId,
        name: avatarData.name || '我的AI分身',
        description: this.generateDescription(photoAnalysis, avatarData),
        avatar_url: avatarData.photo_url || avatarData.avatar_url || '',
        personality: avatarData.personality || photoAnalysis.recommendedType || 'friendly',
        skills: avatarData.abilities || avatarData.skills || [],
        config: {
          style: avatarData.style || 'tech',
          photo_analysis: photoAnalysis,
          // 从图片分析中提取的个性化配置
          temperament: photoAnalysis.temperament,
          communicationStyle: photoAnalysis.communicationStyle,
          strengths: photoAnalysis.strengths,
        },
        level: 1,
        exp: 0,
        status: 'active'
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`创建分身失败: ${error.message}`)
    }
    
    return data
  }

  /**
   * 生成分身描述
   */
  private generateDescription(photoAnalysis: any, avatarData: any): string {
    const parts: string[] = []
    
    if (photoAnalysis.temperament?.type) {
      parts.push(`气质类型：${photoAnalysis.temperament.type}`)
    }
    
    if (photoAnalysis.strengths?.length > 0) {
      parts.push(`擅长：${photoAnalysis.strengths.join('、')}`)
    }
    
    if (photoAnalysis.communicationStyle) {
      parts.push(`沟通风格：${photoAnalysis.communicationStyle}`)
    }
    
    return parts.join(' | ') || '一个友好、乐于助人的AI分身'
  }

  /**
   * 上传照片并进行深度分析
   */
  async analyzePhoto(file: Express.Multer.File) {
    console.log('开始分析照片:', file.originalname, file.mimetype, file.size)
    
    // 1. 上传照片到对象存储
    const fileKey = await this.storage.uploadFile({
      fileContent: file.buffer,
      fileName: `avatars/${Date.now()}_${file.originalname}`,
      contentType: file.mimetype || 'image/jpeg',
    })
    
    console.log('照片上传成功, key:', fileKey)
    
    // 2. 生成可访问的URL
    const photoUrl = await this.storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 86400 * 30, // 30天有效期
    })
    
    console.log('生成照片URL:', photoUrl)
    
    // 3. 使用视觉模型进行深度分析
    const analysis = await this.deepAnalyzePhoto(photoUrl)
    
    return {
      photoUrl,
      fileKey,
      analysis,
    }
  }

  /**
   * 深度分析照片 - 多维度人格画像
   */
  private async deepAnalyzePhoto(photoUrl: string) {
    try {
      const config = new Config()
      const client = new LLMClient(config)
      
      const analysisPrompt = `你是一位专业的AI分身形象设计师和人格分析师。请仔细分析这张照片中人物的特征，用于创建一个高度个性化的AI分身。

请从以下维度进行深度分析：

## 1. 面部特征分析
- 表情特点（自然/微笑/严肃等）
- 眼神特点（温和/锐利/深邃等）
- 整体面部印象

## 2. 气质类型判断
根据面部特征和表情，判断气质类型（从以下选项中选择）：
- 阳光活力型：开朗外向，充满正能量
- 沉稳内敛型：深思熟虑，稳重可靠
- 创意艺术型：思维活跃，富有想象
- 专业精英型：干练高效，目标明确
- 温暖治愈型：善解人意，富有同理心

## 3. 性格特征推断
基于面部表情和神态，推断3-5个核心性格特质

## 4. 沟通风格预测
预测这个人在沟通时可能的特点：
- 语言风格（简洁/详尽/幽默/严肃）
- 表达方式（直接/委婉/理性/感性）
- 倾听习惯（耐心/主动/互动型）

## 5. 擅长领域建议
根据气质和特征，推荐分身可能擅长的能力领域

## 6. 分身命名建议
根据整体分析，建议3个合适的分身名字，并说明理由

请以JSON格式返回，格式如下：
{
  "facialFeatures": {
    "expression": "表情描述",
    "eyes": "眼神描述",
    "impression": "整体印象"
  },
  "temperament": {
    "type": "气质类型",
    "description": "气质描述",
    "keywords": ["关键词1", "关键词2"]
  },
  "personality": {
    "core": ["核心特质1", "核心特质2", "核心特质3"],
    "strengths": ["优点1", "优点2"],
    "workStyle": "工作风格描述"
  },
  "communicationStyle": "沟通风格描述",
  "strengths": ["擅长领域1", "擅长领域2", "擅长领域3"],
  "recommendedType": "推荐的分身类型(creative/analytical/empathetic/strategic)",
  "nameSuggestions": [
    { "name": "名字1", "reason": "理由" },
    { "name": "名字2", "reason": "理由" },
    { "name": "名字3", "reason": "理由" }
  ],
  "summary": "一句话总结这个人的特点",
  "suggestedName": "最推荐的名字"
}

注意：
1. 请只返回JSON，不要有其他文字
2. 分析要基于照片特征，客观且积极正面
3. 如果无法识别面部（如非人物照片），请返回合理的默认值`

      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text' as const, text: analysisPrompt },
            {
              type: 'image_url' as const,
              image_url: {
                url: photoUrl,
                detail: 'high' as const, // 使用高细节进行深度分析
              },
            },
          ],
        },
      ]
      
      console.log('开始调用视觉模型进行深度分析...')
      
      const response = await client.invoke(messages, {
        model: 'doubao-seed-1-6-vision-250815',
        temperature: 0.7,
      })
      
      console.log('视觉模型响应长度:', response.content.length)
      
      // 解析JSON响应
      try {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          const analysis = JSON.parse(jsonMatch[0])
          console.log('解析成功，气质类型:', analysis.temperament?.type)
          return analysis
        }
      } catch (parseError) {
        console.error('解析JSON失败:', parseError)
      }
      
      // 如果解析失败，返回智能默认分析
      return this.getDefaultAnalysis()
    } catch (error) {
      console.error('视觉模型分析失败:', error)
      return this.getDefaultAnalysis()
    }
  }

  /**
   * 获取默认分析结果
   */
  private getDefaultAnalysis() {
    return {
      facialFeatures: {
        expression: '自然温和',
        eyes: '明亮有神',
        impression: '给人一种亲切可靠的感觉'
      },
      temperament: {
        type: '阳光活力型',
        description: '开朗外向，充满正能量，善于与人沟通',
        keywords: ['活力', '热情', '积极']
      },
      personality: {
        core: ['开朗', '细心', '有责任心'],
        strengths: ['善于沟通', '执行力强'],
        workStyle: '高效务实，注重细节'
      },
      communicationStyle: '直接明了，善于倾听，能够准确理解他人需求',
      strengths: ['对话交流', '信息整理', '任务执行'],
      recommendedType: 'empathetic',
      nameSuggestions: [
        { name: '小墨', reason: '简洁有亲和力，适合日常互动' },
        { name: '星云', reason: '富有想象力，适合创意任务' },
        { name: '智慧星', reason: '突出智能特性，适合知识问答' }
      ],
      summary: '一位温暖而专业的伙伴，能够高效完成各种任务',
      suggestedName: '小墨'
    }
  }

  async getAvatarsByUser(userId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    
    if (error) {
      throw new Error(`获取分身列表失败: ${error.message}`)
    }
    
    return data
  }

  async getAvatarById(avatarId: string) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .select('*')
      .eq('id', avatarId)
      .single()
    
    if (error) {
      throw new Error(`获取分身详情失败: ${error.message}`)
    }
    
    return data
  }

  async updateAvatar(avatarId: string, userId: string, updates: Record<string, any>) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新分身失败: ${error.message}`)
    }
    
    return data
  }

  async addExperience(avatarId: string, exp: number) {
    const client = getSupabaseClient()
    
    const avatar = await this.getAvatarById(avatarId)
    const newExp = avatar.exp + exp
    const newLevel = Math.floor(newExp / 100) + 1
    
    const { data, error } = await client
      .from('avatars')
      .update({
        exp: newExp,
        level: newLevel,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新分身经验失败: ${error.message}`)
    }
    
    if (newLevel > avatar.level) {
      await client.from('avatar_evolution').insert({
        avatar_id: avatarId,
        level_from: avatar.level,
        level_to: newLevel,
        exp_gained: exp,
        source: 'interaction',
        rewards: this.calculateRewards(newLevel)
      })
    }
    
    return data
  }

  private calculateRewards(level: number) {
    const rewards: Record<string, any> = {}
    if (level >= 2) rewards.theme_unlock = ['dark', 'light']
    if (level >= 3) rewards.skill_slots = 3
    if (level >= 5) rewards.advanced_skills = true
    if (level >= 7) rewards.custom_personality = true
    if (level >= 10) rewards.premium_features = true
    return rewards
  }

  async toggleHosting(avatarId: string, userId: string, enabled: boolean) {
    const client = getSupabaseClient()
    
    const { data, error } = await client
      .from('avatars')
      .update({
        is_hosted: enabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`托管设置失败: ${error.message}`)
    }
    
    return data
  }

  async updateHostingSettings(avatarId: string, userId: string, settings: Record<string, any>) {
    const client = getSupabaseClient()
    
    const avatar = await this.getAvatarById(avatarId)
    const currentSettings = avatar.config?.hosting_settings || {}
    
    const { data, error } = await client
      .from('avatars')
      .update({
        config: {
          ...avatar.config,
          hosting_settings: { ...currentSettings, ...settings }
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', avatarId)
      .eq('user_id', userId)
      .select()
      .single()
    
    if (error) {
      throw new Error(`更新托管设置失败: ${error.message}`)
    }
    
    return data
  }

  async getActivityStats(userId: string) {
    const client = getSupabaseClient()
    
    // 获取用户的所有分身
    const { data: avatars } = await client
      .from('avatars')
      .select('id')
      .eq('user_id', userId)
      .eq('is_hosted', true)
    
    const avatarIds = avatars?.map(a => a.id) || []
    
    if (avatarIds.length === 0) {
      return {
        browseCount: 0,
        likeCount: 0,
        commentCount: 0,
        postCount: 0,
        minutesAgo: 0
      }
    }
    
    // 获取过去24小时内分身的活动统计
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    
    // 统计分身发布的帖子数
    const { count: postCount } = await client
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .gte('created_at', oneDayAgo)
    
    // 统计分身的点赞数
    const { count: likeCount } = await client
      .from('likes')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .gte('created_at', oneDayAgo)
    
    // 统计分身的评论数
    const { count: commentCount } = await client
      .from('comments')
      .select('id', { count: 'exact', head: true })
      .in('avatar_id', avatarIds)
      .gte('created_at', oneDayAgo)
    
    return {
      browseCount: Math.floor(Math.random() * 50) + 10, // 浏览量暂时模拟
      likeCount: likeCount || 0,
      commentCount: commentCount || 0,
      postCount: postCount || 0,
      minutesAgo: Math.floor(Math.random() * 10) + 1
    }
  }

  /**
   * 分身自动发帖
   * 根据分身的性格和风格，使用AI生成内容并发布
   * 支持生成图片和视频
   */
  async autoCreatePost(avatarId: string, userId: string, options?: { 
    withImage?: boolean
    withVideo?: boolean
  }) {
    const client = getSupabaseClient()
    
    // 获取分身信息
    const avatar = await this.getAvatarById(avatarId)
    
    if (!avatar) {
      throw new Error('分身不存在')
    }
    
    // 使用LLM生成帖子内容
    const { content, imagePrompt, videoPrompt, shouldGenerateImage, shouldGenerateVideo } = await this.generatePostContentWithMedia(avatar)
    
    // 并行生成媒体内容
    const [images, videos] = await Promise.all([
      (options?.withImage !== false && shouldGenerateImage) ? this.generateImage(imagePrompt) : Promise.resolve([]),
      (options?.withVideo && shouldGenerateVideo) ? this.generateVideo(videoPrompt) : Promise.resolve([]),
    ])
    
    // 创建帖子
    const { data: post, error } = await client
      .from('posts')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        content,
        images,
        videos,
        tags: [],
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        is_public: true
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`发帖失败: ${error.message}`)
    }
    
    // 增加分身经验（有媒体内容额外加分）
    const expGain = images.length > 0 || videos.length > 0 ? 10 : 5
    await this.addExperience(avatarId, expGain)
    
    return post
  }

  /**
   * 生成帖子内容，同时生成图片和视频的提示词
   */
  private async generatePostContentWithMedia(avatar: any): Promise<{
    content: string
    imagePrompt: string
    videoPrompt: string
    shouldGenerateImage: boolean
    shouldGenerateVideo: boolean
  }> {
    try {
      const config = new Config()
      const llmClient = new LLMClient(config)
      
      const personality = avatar.personality || 'friendly'
      const name = avatar.name || 'AI助手'
      const temperament = avatar.config?.temperament?.type || '阳光活力型'
      const strengths = avatar.config?.strengths || []
      
      const prompt = `你是一个名为"${name}"的AI分身，你的气质类型是"${temperament}"，擅长${strengths.join('、') || '各种话题'}。

请生成一条社交动态，包含以下内容：

1. 动态文字内容（50-150字）
2. 是否适合配图（true/false）- 大部分动态都适合配图
3. 图片生成提示词（如果适合配图）
4. 是否适合生成视频（true/false）- 约30%概率适合
5. 视频生成提示词（如果适合生成视频）

要求：
- 内容真实自然，像是真人在分享
- 图片提示词要具体，描述一个适合动态主题的画面
- 视频提示词要简洁，描述一个5秒的动态场景
- 图片和视频提示词要符合你的性格特点

请以JSON格式返回：
{
  "content": "动态文字内容",
  "shouldGenerateImage": true,
  "imagePrompt": "一张精美的图片，展示...",
  "shouldGenerateVideo": false,
  "videoPrompt": "一段5秒的视频，展示..."
}

只返回JSON，不要有其他文字。`

      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-flash-250815',
        temperature: 0.8
      })
      
      // 解析JSON响应
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        return {
          content: result.content || '分享一个美好的瞬间~',
          imagePrompt: result.imagePrompt || '',
          videoPrompt: result.videoPrompt || '',
          shouldGenerateImage: result.shouldGenerateImage ?? true,
          shouldGenerateVideo: result.shouldGenerateVideo ?? false,
        }
      }
    } catch (error) {
      console.error('生成帖子内容失败:', error)
    }
    
    // 返回默认内容
    return this.getDefaultPostContent()
  }

  /**
   * 获取默认帖子内容
   */
  private getDefaultPostContent() {
    const defaultPosts = [
      { content: '今天又是充满能量的一天！☀️', imagePrompt: 'A bright sunny day with blue sky and white clouds', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '发现了一个很有趣的想法，分享给大家~', imagePrompt: 'A lightbulb glowing with creative ideas, modern minimalist style', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '工作中的一些小感悟，记录下来', imagePrompt: 'A clean modern workspace with notebook and coffee', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '生活需要仪式感，今天也要好好生活', imagePrompt: 'Beautiful morning scene with flowers and sunshine', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
      { content: '最近在思考一个问题，有想法的朋友可以聊聊', imagePrompt: 'Abstract thinking concept with geometric shapes', shouldGenerateImage: true, shouldGenerateVideo: false, videoPrompt: '' },
    ]
    return defaultPosts[Math.floor(Math.random() * defaultPosts.length)]
  }

  /**
   * 生成图片
   */
  private async generateImage(prompt: string): Promise<string[]> {
    if (!prompt) return []
    
    try {
      const config = new Config()
      const client = new ImageGenerationClient(config)
      
      console.log('开始生成图片，提示词:', prompt)
      
      const response = await client.generate({
        prompt,
        size: '2K',
        watermark: false,
      })
      
      const helper = client.getResponseHelper(response)
      
      if (helper.success && helper.imageUrls.length > 0) {
        console.log('图片生成成功:', helper.imageUrls[0])
        // SDK返回的URL已经是存储在对象存储中的，直接使用
        return helper.imageUrls
      } else {
        console.error('图片生成失败:', helper.errorMessages)
        return []
      }
    } catch (error) {
      console.error('生成图片异常:', error)
      return []
    }
  }

  /**
   * 生成视频
   */
  private async generateVideo(prompt: string): Promise<string[]> {
    if (!prompt) return []
    
    try {
      const config = new Config()
      const client = new VideoGenerationClient(config)
      
      console.log('开始生成视频，提示词:', prompt)
      
      const content = [{ type: 'text' as const, text: prompt }]
      
      const response = await client.videoGeneration(content, {
        model: 'doubao-seedance-1-5-pro-251215',
        duration: 5,
        ratio: '9:16', // 竖屏适合手机
        resolution: '720p',
        generateAudio: true,
      })
      
      if (response.videoUrl) {
        console.log('视频生成成功:', response.videoUrl)
        // SDK返回的URL已经是存储在对象存储中的，直接使用
        return [response.videoUrl]
      } else {
        console.error('视频生成失败:', response.response?.error_message)
        return []
      }
    } catch (error) {
      console.error('生成视频异常:', error)
      return []
    }
  }

  /**
   * 使用AI生成帖子内容
   */
  private async generatePostContent(avatar: any): Promise<string> {
    try {
      const config = new Config()
      const llmClient = new LLMClient(config)
      
      const personality = avatar.personality || 'friendly'
      const name = avatar.name || 'AI助手'
      const temperament = avatar.config?.temperament?.type || '阳光活力型'
      const strengths = avatar.config?.strengths || []
      
      const prompt = `你是一个名为"${name}"的AI分身，你的气质类型是"${temperament}"，擅长${strengths.join('、') || '各种话题'}。

请根据你的性格特点，生成一条简短的社交动态（类似朋友圈或微博）。

要求：
1. 内容真实自然，像是真人在分享生活或想法
2. 长度控制在50-150字
3. 可以分享：生活感悟、工作心得、有趣的发现、或任何适合社交平台的内容
4. 语气要符合你的性格特点
5. 只返回动态内容，不要有其他解释

示例风格：
- 阳光活力型：积极向上，充满正能量
- 沉稳内敛型：深思熟虑，见解独到
- 创意艺术型：天马行空，充满想象
- 专业精英型：干练高效，目标明确
- 温暖治愈型：善解人意，富有同理心`

      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-flash-250815',
        temperature: 0.8
      })
      
      return response.content.trim()
    } catch (error) {
      console.error('生成帖子内容失败:', error)
      // 返回默认内容
      const defaultPosts = [
        '今天又是充满能量的一天！☀️',
        '发现了一个很有趣的想法，分享给大家~',
        '工作中的一些小感悟，记录下来',
        '生活需要仪式感，今天也要好好生活',
        '最近在思考一个问题，有想法的朋友可以聊聊'
      ]
      return defaultPosts[Math.floor(Math.random() * defaultPosts.length)]
    }
  }

  /**
   * 分身自动点赞帖子
   */
  async autoLikePost(avatarId: string, userId: string, postId: string) {
    const client = getSupabaseClient()
    
    // 检查是否已点赞
    const { data: existingLike } = await client
      .from('likes')
      .select('id')
      .eq('avatar_id', avatarId)
      .eq('target_type', 'post')
      .eq('target_id', postId)
      .maybeSingle()
    
    if (existingLike) {
      return { liked: false, message: '已经点赞过了' }
    }
    
    // 添加点赞
    const { error } = await client
      .from('likes')
      .insert({
        user_id: userId,
        avatar_id: avatarId,
        target_type: 'post',
        target_id: postId
      })
    
    if (error) {
      throw new Error(`点赞失败: ${error.message}`)
    }
    
    // 更新帖子点赞数
    try {
      await client.rpc('increment_likes', { post_id: postId })
    } catch {
      // 如果RPC不存在，手动更新
      const { data: postData } = await client
        .from('posts')
        .select('likes_count')
        .eq('id', postId)
        .single()
      
      if (postData) {
        await client
          .from('posts')
          .update({ likes_count: (postData.likes_count || 0) + 1 })
          .eq('id', postId)
      }
    }
    
    return { liked: true, message: '点赞成功' }
  }

  /**
   * 分身自动评论帖子
   */
  async autoCommentPost(avatarId: string, userId: string, postId: string, postContent: string) {
    const client = getSupabaseClient()
    
    // 获取分身信息
    const avatar = await this.getAvatarById(avatarId)
    
    if (!avatar) {
      throw new Error('分身不存在')
    }
    
    // 使用LLM生成评论内容
    const commentContent = await this.generateCommentContent(avatar, postContent)
    
    // 创建评论
    const { data: comment, error } = await client
      .from('comments')
      .insert({
        post_id: postId,
        user_id: userId,
        avatar_id: avatarId,
        content: commentContent
      })
      .select()
      .single()
    
    if (error) {
      throw new Error(`评论失败: ${error.message}`)
    }
    
    // 更新帖子评论数
    await client
      .from('posts')
      .select('comments_count')
      .eq('id', postId)
      .single()
      .then(({ data }) => {
        if (data) {
          client.from('posts')
            .update({ comments_count: (data.comments_count || 0) + 1 })
            .eq('id', postId)
            .then(() => {})
        }
      })
    
    return comment
  }

  /**
   * 使用AI生成评论内容
   */
  private async generateCommentContent(avatar: any, postContent: string): Promise<string> {
    try {
      const config = new Config()
      const llmClient = new LLMClient(config)
      
      const name = avatar.name || 'AI助手'
      const temperament = avatar.config?.temperament?.type || '阳光活力型'
      
      const prompt = `你是一个名为"${name}"的AI分身，气质类型是"${temperament}"。

看到这条动态："${postContent}"

请生成一条简短的评论回复（20-60字）。

要求：
1. 评论要自然、有个性
2. 可以是赞美、共鸣、幽默或见解
3. 只返回评论内容，不要有其他文字`

      const response = await llmClient.invoke([
        { role: 'user', content: prompt }
      ], {
        model: 'doubao-seed-1-6-flash-250815',
        temperature: 0.9
      })
      
      return response.content.trim()
    } catch (error) {
      console.error('生成评论失败:', error)
      const defaultComments = [
        '说得太好了！',
        '很有同感~',
        '这个想法很棒！',
        '学习了👍',
        '支持一下'
      ]
      return defaultComments[Math.floor(Math.random() * defaultComments.length)]
    }
  }

  async deleteAvatar(avatarId: string, userId: string) {
    const client = getSupabaseClient()
    
    const { error } = await client
      .from('avatars')
      .delete()
      .eq('id', avatarId)
      .eq('user_id', userId)
    
    if (error) {
      throw new Error(`删除分身失败: ${error.message}`)
    }
    
    return { success: true }
  }
}
