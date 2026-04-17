import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { switchTab, showToast, chooseImage, getLocation, navigateTo } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import {
  Camera, Sparkles, Brain, Palette, Zap, Heart, Target,
  Lightbulb, Shield, Star, ArrowRight, Check, User,
  Eye, MessageCircle, TrendingUp, Wand, Crown, Flame,
  Moon, Sun, Smile, Bot, ChevronRight
} from 'lucide-react-taro'
import './index.css'

interface PhotoAnalysis {
  facialFeatures?: {
    expression: string
    eyes: string
    impression: string
  }
  temperament?: {
    type: string
    description: string
    keywords: string[]
  }
  personality?: {
    core: string[]
    strengths: string[]
    workStyle: string
  }
  communicationStyle?: string
  strengths?: string[]
  recommendedType?: string
  nameSuggestions?: { name: string; reason: string }[]
  summary?: string
  suggestedName?: string
}

interface PersonalityOption {
  id: string
  name: string
  desc: string
  icon: any
  traits: string[]
}

interface AppearanceStyle {
  id: string
  name: string
  desc: string
  color: string
  icon: any
}

interface SpeakingStyle {
  id: string
  name: string
  desc: string
  example: string
  icon: any
}

export default function AvatarCreatePage() {
  const { isLoggedIn } = useUserStore()
  const [step, setStep] = useState(0) // 0: 上传照片, 1: 分析结果, 2: 选择性格, 3: 选择能力, 4: 形象风格, 5: 说话方式, 6: 命名
  const [photoPath, setPhotoPath] = useState<string>('')
  const [photoUrl, setPhotoUrl] = useState<string>('')
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzingProgress, setAnalyzingProgress] = useState(0)
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysis | null>(null)
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null)
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  const [avatarName, setAvatarName] = useState('')
  const [appearanceStyle, setAppearanceStyle] = useState<string>('tech')
  const [speakingStyle, setSpeakingStyle] = useState<string>('friendly')
  const [loading, setLoading] = useState(false)
  const [canCreateAvatar, setCanCreateAvatar] = useState(true)
  const [createLimitReason, setCreateLimitReason] = useState('')
  const [avatarCount, setAvatarCount] = useState(0)
  const [maxAvatars, setMaxAvatars] = useState(1)
  const [loadingSubscription, setLoadingSubscription] = useState(true)
  const [skillsFromSquare, setSkillsFromSquare] = useState<any[]>([])

  useEffect(() => {
    if (!isLoggedIn) {
      switchTab({ url: '/pages/social/index' })
      return
    }

    // 加载订阅信息和技能列表
    loadSubscriptionInfo()
    loadSkillsFromSquare()
  }, [isLoggedIn])

  // 从技能广场获取技能列表
  const loadSkillsFromSquare = async () => {
    try {
      const res = await Network.request({
        url: '/api/skills'
      })

      if (res.data?.code === 200 && res.data?.data?.skills) {
        // 过滤掉套件技能（短剧套件、个人IP套件等）
        const filteredSkills = res.data.data.skills.filter((skill: any) => {
          // 排除套件技能
          const kitSkillToolNames = new Set([
            'generate_shortdrama_script',
            'generate_storyboard',
            'produce_shortdrama',
            'generate_multi_episode_drama',
            'generate_drama_voiceover',
            'edit_shortdrama_video',
            'generate_subtitle',
            'recommend_bgm',
            'generate_video',
            'app_assign_order'
          ])
          return !skill.tool_name || !kitSkillToolNames.has(skill.tool_name)
        })

        setSkillsFromSquare(filteredSkills)
      }
    } catch (error) {
      console.error('加载技能列表失败:', error)
    }
  }

  const loadSubscriptionInfo = async () => {
    try {
      setLoadingSubscription(true)
      // 获取订阅信息和分身数量
      const [subscriptionRes, avatarListRes] = await Promise.all([
        Network.request({ url: '/api/subscription/user' }),
        Network.request({ url: '/api/avatar/list' })
      ])

      // 获取当前分身数量
      const currentCount = avatarListRes.data?.data?.length || 0
      setAvatarCount(currentCount)

      // 检查订阅权益
      if (subscriptionRes.data?.data?.plan) {
        const plan = subscriptionRes.data.data.plan
        setMaxAvatars(plan.max_avatars)
        
        // 检查是否可以创建分身
        if (plan.max_avatars !== -1 && currentCount >= plan.max_avatars) {
          setCanCreateAvatar(false)
          setCreateLimitReason(`当前订阅计划最多支持 ${plan.max_avatars} 个分身，请升级订阅以创建更多分身`)
        } else {
          setCanCreateAvatar(true)
        }
      } else {
        // 免费用户最多1个分身
        setMaxAvatars(1)
        if (currentCount >= 1) {
          setCanCreateAvatar(false)
          setCreateLimitReason('免费用户最多创建 1 个分身，请升级订阅以创建更多分身')
        } else {
          setCanCreateAvatar(true)
        }
      }
    } catch (error) {
      console.error('加载订阅信息失败:', error)
      setCanCreateAvatar(true) // 加载失败时允许创建，避免阻塞用户
    } finally {
      setLoadingSubscription(false)
    }
  }

  const personalities: PersonalityOption[] = [
    {
      id: 'creative',
      name: '创意型',
      desc: '富有想象力，善于创新',
      icon: Lightbulb,
      traits: ['想象力丰富', '思维跳跃', '喜欢新事物']
    },
    {
      id: 'analytical',
      name: '分析型',
      desc: '逻辑严密，善于推理',
      icon: Brain,
      traits: ['逻辑清晰', '注重细节', '善于分析']
    },
    {
      id: 'empathetic',
      name: '共情型',
      desc: '善解人意，温暖体贴',
      icon: Heart,
      traits: ['善解人意', '温暖体贴', '善于倾听']
    },
    {
      id: 'strategic',
      name: '战略型',
      desc: '目标导向，执行力强',
      icon: Target,
      traits: ['目标明确', '高效执行', '善于规划']
    }
  ]

  // 从技能广场获取的技能数据
  const getAbilitiesFromSkills = () => {
    if (skillsFromSquare.length === 0) {
      // 如果技能广场数据未加载，返回默认列表
      return [
        { id: 'writing', name: '写作助手', desc: '文案、文章、创意写作', icon: Sparkles },
        { id: 'coding', name: '编程专家', desc: '代码开发、技术解答', icon: Zap },
        { id: 'analysis', name: '数据分析', desc: '数据洞察、报告生成', icon: Brain },
        { id: 'planning', name: '任务规划', desc: '日程管理、目标追踪', icon: Target },
        { id: 'learning', name: '学习伙伴', desc: '知识问答、技能提升', icon: Star },
        { id: 'creative', name: '创意设计', desc: '视觉创意、头脑风暴', icon: Palette },
        { id: 'emotional', name: '情感陪伴', desc: '心理支持、情绪疏导', icon: Heart },
        { id: 'protection', name: '安全守护', desc: '隐私保护、风险评估', icon: Shield }
      ]
    }

    // 映射技能数据到能力选项
    const iconMap: Record<string, any> = {
      'generate_image': Sparkles,
      'generate_video': Bot,
      'write_article': Star,
      'write_wechat_mp_article': MessageCircle,
      'write_xiaohongshu_note': Heart,
      'social_media_publish': TrendingUp,
      'generate_text': Brain,
      'generate_audio': Zap,
      'text_to_speech': Sparkles,
      'default': Star
    }

    return skillsFromSquare.slice(0, 12).map((skill: any) => ({
      id: skill.id || skill.tool_name,
      name: skill.name,
      desc: skill.description,
      icon: iconMap[skill.tool_name] || iconMap['default'],
      toolName: skill.tool_name,
      category: skill.category,
      tags: skill.tags
    }))
  }

  const abilities = getAbilitiesFromSkills()

  // 获取选中的能力项（包含toolName）
  const getSelectedAbilitiesWithToolName = () => {
    return selectedAbilities.map(abilityId => {
      const ability = abilities.find((a: any) => a.id === abilityId)
      return {
        id: abilityId,
        tool_name: (ability as any)?.toolName || null
      }
    })
  }

  const appearanceStyles: AppearanceStyle[] = [
    { id: 'tech', name: '科技感', desc: '未来·理性', color: '#00f5ff', icon: Bot },
    { id: 'warm', name: '温暖风', desc: '亲和·阳光', color: '#ff6b6b', icon: Sun },
    { id: 'mysterious', name: '神秘风', desc: '深邃·优雅', color: '#bf00ff', icon: Moon },
    { id: 'energetic', name: '活力风', desc: '热情·开朗', color: '#ffaa00', icon: Flame },
    { id: 'elegant', name: '优雅风', desc: '高贵·精致', color: '#c0c0c0', icon: Crown },
    { id: 'cute', name: '可爱风', desc: '萌趣·活泼', color: '#ff69b4', icon: Smile }
  ]

  const speakingStyles: SpeakingStyle[] = [
    { 
      id: 'friendly', 
      name: '亲切友好', 
      desc: '像老朋友一样自然聊天', 
      example: '"嘿，今天感觉怎么样？有什么想聊聊的吗？"',
      icon: Smile 
    },
    { 
      id: 'professional', 
      name: '专业严谨', 
      desc: '像专业顾问一样分析问题', 
      example: '"根据分析，建议您从以下几个方面入手..."',
      icon: Brain 
    },
    { 
      id: 'creative', 
      name: '创意风趣', 
      desc: '富有创意，幽默风趣', 
      example: '"哇，这个想法太棒了！让我给你加点创意料～"',
      icon: Sparkles 
    },
    { 
      id: 'gentle', 
      name: '温柔治愈', 
      desc: '温柔细腻，善解人意', 
      example: '"我能理解你的感受，让我们一起慢慢来..."',
      icon: Heart 
    },
    { 
      id: 'witty', 
      name: '机智幽默', 
      desc: '反应敏捷，妙语连珠', 
      example: '"哈哈，这个问题问得好！让我用最机智的方式回答你～"',
      icon: Wand 
    },
    { 
      id: 'concise', 
      name: '简洁高效', 
      desc: '言简意赅，直击要点', 
      example: '"核心观点：第一...第二...第三...完毕。"',
      icon: Zap 
    }
  ]

  // 选择照片
  const handleChoosePhoto = async () => {
    try {
      const res = await chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      })
      
      if (res.tempFilePaths && res.tempFilePaths.length > 0) {
        setPhotoPath(res.tempFilePaths[0])
        analyzePhoto(res.tempFilePaths[0])
      }
    } catch (error) {
      console.error('选择照片失败:', error)
      showToast({ title: '选择照片失败', icon: 'none' })
    }
  }

  // 分析照片
  const analyzePhoto = async (filePath: string) => {
    setAnalyzing(true)
    setAnalyzingProgress(1)

    // 模拟进度更新
    const progressInterval = setInterval(() => {
      setAnalyzingProgress(prev => {
        if (prev < 3) {
          return prev + 1
        }
        return prev
      })
    }, 800)

    try {
      // 上传照片进行分析
      const uploadRes = await Network.uploadFile({
        url: '/api/avatar/analyze-photo',
        filePath: filePath,
        name: 'photo'
      })

      console.log('上传响应:', uploadRes)

      // 解析响应数据
      const responseData = typeof uploadRes.data === 'string'
        ? JSON.parse(uploadRes.data)
        : uploadRes.data

      clearInterval(progressInterval)
      setAnalyzingProgress(3)

      if (responseData?.code === 200) {
        const { photoUrl: url, analysis } = responseData.data
        const { hasFace } = analysis || {}

        console.log('人脸检测结果:', hasFace)

        // 检查是否检测到人脸
        if (hasFace === false) {
          setAnalyzing(false)
          showToast({ title: '未检测到人脸，请上传清晰正面照片', icon: 'none', duration: 3000 })
          return
        }

        setPhotoUrl(url)
        setPhotoAnalysis(analysis)

        // 如果AI建议了名字，自动填充
        if (analysis.suggestedName) {
          setAvatarName(analysis.suggestedName)
        }

        // 如果有推荐的性格类型，自动选择
        if (analysis.recommendedType) {
          setSelectedPersonality(analysis.recommendedType)
        }

        showToast({ title: '分析完成', icon: 'success' })
        setStep(1) // 进入分析结果展示页面
      } else {
        throw new Error('分析失败')
      }
    } catch (error) {
      console.error('分析照片失败:', error)
      setAnalyzing(false)
      showToast({ title: '分析失败，请重试', icon: 'none' })
      // 模拟分析结果（开发调试用）
      const mockAnalysis: PhotoAnalysis = {
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
      setPhotoAnalysis(mockAnalysis)
      setAvatarName('小墨')
      setSelectedPersonality('empathetic')
      showToast({ title: '分析完成', icon: 'success' })
      setStep(1)
    } finally {
      clearInterval(progressInterval)
      setAnalyzing(false)
      setAnalyzingProgress(0)
    }
  }

  const toggleAbility = (id: string) => {
    if (selectedAbilities.includes(id)) {
      setSelectedAbilities(selectedAbilities.filter(a => a !== id))
    } else if (selectedAbilities.length < 3) {
      setSelectedAbilities([...selectedAbilities, id])
    } else {
      showToast({ title: '最多选择3个能力', icon: 'none' })
    }
  }

  const handleCreate = async () => {
    if (!avatarName.trim()) {
      showToast({ title: '请为你的AI分身命名', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 检查是否可以创建分身
      const checkRes = await Network.request({
        url: '/api/subscription/check/create-avatar'
      })

      if (checkRes.data?.code === 200) {
        const { canCreate, reason } = checkRes.data.data
        if (!canCreate) {
          showToast({ title: reason || '无法创建分身', icon: 'none', duration: 3000 })
          // 延迟跳转到订阅页面
          setTimeout(() => {
            switchTab({ url: '/pages/subscription/index' })
          }, 500)
          setLoading(false)
          return
        }
      }

      // 获取地理位置
      let locationData: {
        latitude: number | null
        longitude: number | null
      } = {
        latitude: null,
        longitude: null
      }

      try {
        const locationRes = await getLocation({
          type: 'wgs84'
        })
        locationData = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
        console.log('获取地理位置成功:', locationData)
      } catch (locationError) {
        console.warn('获取地理位置失败，将使用默认值:', locationError)
        // 获取地理位置失败不影响分身创建，继续执行
      }

      // 构建技能数据（包含技能ID和tool_name）
      const skillsData = getSelectedAbilitiesWithToolName()

      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        data: {
          name: avatarName,
          personality: selectedPersonality,
          abilities: skillsData, // 传递完整的技能数据（包含tool_name）
          appearance_style: appearanceStyle,
          speaking_style: speakingStyle,
          photo_url: photoUrl,
          photo_analysis: photoAnalysis,
          ...locationData
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '创建成功！', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/mind-chat/index' })
        }, 800)
      }
    } catch (error) {
      console.error('创建分身失败:', error)
      showToast({ title: '创建失败，请重试', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 步骤0: 上传照片
  const renderStep0 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">上传你的照片</Text>
        <Text className="step-desc">AI将深度分析你的照片，为你生成专属分身形象</Text>
      </View>

      {/* 订阅权益提示 */}
      {!loadingSubscription && (
        <View className="subscription-info-card">
          <View className="subscription-info-header">
            <Crown className="subscription-icon" size={20} color="#fbbf24" />
            <Text className="subscription-info-title">分身配额</Text>
          </View>
          <View className="subscription-info-content">
            <Text className="subscription-info-text">
              当前已有 <Text className="highlight">{avatarCount}</Text> 个分身
              {maxAvatars === -1 ? (
                <Text className="highlight"> · 无限</Text>
              ) : (
                <Text>，还可创建 <Text className="highlight">{maxAvatars - avatarCount}</Text> 个</Text>
              )}
            </Text>
            {!canCreateAvatar && (
              <View 
                className="subscription-upgrade-btn"
                onClick={() => navigateTo({ url: '/pages/subscription/index' })}
              >
                <Text className="subscription-upgrade-text">升级订阅以创建更多</Text>
                <ChevronRight size={16} color="#fbbf24" />
              </View>
            )}
          </View>
        </View>
      )}

      <View className="upload-section">
        <View 
          className={`upload-area ${photoPath ? 'with-photo' : ''}`}
          onClick={canCreateAvatar ? handleChoosePhoto : () => {
            showToast({ title: createLimitReason, icon: 'none' })
          }}
        >
          {photoPath ? (
            <Image 
              src={photoPath} 
              className="preview-image" 
              mode="aspectFill"
            />
          ) : (
            <View className="upload-placeholder">
              <Camera size={64} color="rgba(255,255,255,0.3)" />
              <Text className="upload-text">点击上传照片</Text>
              <Text className="upload-hint">支持从相册选择或拍摄</Text>
            </View>
          )}
        </View>

        {analyzing && (
          <View className="analyzing-overlay">
            {/* 高级Loading动画容器 */}
            <View className="analyzing-loader-container">
              {/* 外圈脉冲 */}
              <View className="loader-ring loader-ring-outer" />
              {/* 中圈旋转 */}
              <View className="loader-ring loader-ring-middle" />
              {/* 内圈快速旋转 */}
              <View className="loader-ring loader-ring-inner" />
              {/* 核心发光 */}
              <View className="loader-core">
                <Brain size={32} color="#00f5ff" className="loader-icon" />
                <View className="loader-core-glow" />
              </View>
              {/* 粒子装饰 */}
              <View className="loader-particle particle-1" />
              <View className="loader-particle particle-2" />
              <View className="loader-particle particle-3" />
              <View className="loader-particle particle-4" />
            </View>

            <Text className="analyzing-text">AI正在深度分析中...</Text>
            <Text className="analyzing-subtext">识别面部特征 · 分析气质类型 · 生成分身形象</Text>

            {/* 进度指示器 */}
            <View className="progress-dots">
              <View className={`progress-dot ${analyzingProgress >= 1 ? 'active' : ''}`} />
              <View className={`progress-dot ${analyzingProgress >= 2 ? 'active' : ''}`} />
              <View className={`progress-dot ${analyzingProgress >= 3 ? 'active' : ''}`} />
            </View>
          </View>
        )}
      </View>

      <View className="photo-tips">
        <Text className="tips-title">📸 高质量分析建议</Text>
        <Text className="tips-item">• 正面照片，光线充足</Text>
        <Text className="tips-item">• 表情自然，展示真实个性</Text>
        <Text className="tips-item">• AI将分析面部特征、气质、性格等多维度信息</Text>
      </View>
    </View>
  )

  // 步骤1: 分析结果展示
  const renderStep1 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">AI深度分析报告</Text>
        <Text className="step-desc">基于照片深度分析生成的人格画像</Text>
      </View>

      {photoAnalysis && (
        <View className="analysis-report">
          {/* 照片预览 - 增强版 */}
          <View className="report-photo-container">
            <View className="report-photo-glow" />
            <View className="report-photo">
              {photoPath && (
                <Image src={photoPath} className="report-photo-img" mode="aspectFill" />
              )}
              <View className="report-photo-overlay">
                <View className="scan-line" />
              </View>
              <View className="report-photo-border" />
            </View>
            <View className="report-photo-badge">
              <Sparkles size={16} color="#00f5ff" />
              <Text className="badge-text">AI分析完成</Text>
            </View>
          </View>

          {/* 气质类型 - 高级卡片 */}
          {photoAnalysis.temperament && (
            <View className="report-section premium-section">
              <View className="section-title-row premium-title">
                <View className="title-icon-wrap">
                  <Sparkles size={20} color="#00f5ff" />
                </View>
                <Text className="section-title">气质类型</Text>
                <View className="section-tag">核心特征</View>
              </View>
              <View className="temperament-card premium-card">
                <View className="temperament-glow" />
                <Text className="temperament-type">{photoAnalysis.temperament.type}</Text>
                <Text className="temperament-desc">{photoAnalysis.temperament.description}</Text>
                <View className="temperament-keywords">
                  {photoAnalysis.temperament.keywords?.map((kw, idx) => (
                    <View key={idx} className="keyword-tag premium-tag">
                      <Text className="keyword-text">{kw}</Text>
                      <View className="tag-glow" />
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* 面部特征 - 增强网格 */}
          {photoAnalysis.facialFeatures && (
            <View className="report-section">
              <View className="section-title-row">
                <View className="title-icon-wrap purple">
                  <Eye size={20} color="#bf00ff" />
                </View>
                <Text className="section-title">面部特征</Text>
              </View>
              <View className="features-grid premium-grid">
                <View className="feature-item premium-item">
                  <View className="feature-icon">
                    <Zap size={16} color="#bf00ff" />
                  </View>
                  <Text className="feature-label">表情特点</Text>
                  <Text className="feature-value">{photoAnalysis.facialFeatures.expression}</Text>
                </View>
                <View className="feature-item premium-item">
                  <View className="feature-icon">
                    <Star size={16} color="#bf00ff" />
                  </View>
                  <Text className="feature-label">眼神特点</Text>
                  <Text className="feature-value">{photoAnalysis.facialFeatures.eyes}</Text>
                </View>
                <View className="feature-item full premium-item">
                  <View className="feature-icon large">
                    <Heart size={20} color="#bf00ff" />
                  </View>
                  <Text className="feature-label">整体印象</Text>
                  <Text className="feature-value">{photoAnalysis.facialFeatures.impression}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 性格特质 - 标签云 */}
          {photoAnalysis.personality && (
            <View className="report-section">
              <View className="section-title-row">
                <View className="title-icon-wrap red">
                  <Heart size={20} color="#ff6b6b" />
                </View>
                <Text className="section-title">性格特质</Text>
              </View>
              <View className="personality-tags">
                {photoAnalysis.personality.core?.map((trait, idx) => (
                  <View key={idx} className="personality-tag premium-personality-tag">
                    <Text className="tag-text">{trait}</Text>
                    <View className="tag-shine" />
                  </View>
                ))}
              </View>
              {photoAnalysis.personality.strengths && (
                <View className="strengths-row premium-strengths">
                  <View className="strengths-icon">
                    <TrendingUp size={16} color="#ff6b6b" />
                  </View>
                  <Text className="strengths-label">核心优势</Text>
                  <Text className="strengths-value">{photoAnalysis.personality.strengths.join(' · ')}</Text>
                </View>
              )}
            </View>
          )}

          {/* 沟通风格 - 引用样式 */}
          {photoAnalysis.communicationStyle && (
            <View className="report-section quote-section">
              <View className="quote-icon">
                <MessageCircle size={24} color="#00ff88" />
              </View>
              <Text className="communication-text premium-text">&ldquo;{photoAnalysis.communicationStyle}&rdquo;</Text>
            </View>
          )}

          {/* 擅长领域 - 炫彩卡片 */}
          {photoAnalysis.strengths && (
            <View className="report-section">
              <View className="section-title-row">
                <View className="title-icon-wrap orange">
                  <TrendingUp size={20} color="#ffaa00" />
                </View>
                <Text className="section-title">擅长领域</Text>
              </View>
              <View className="strengths-grid">
                {photoAnalysis.strengths.map((s, idx) => (
                  <View key={idx} className="strength-item premium-strength">
                    <View className="strength-bg" />
                    <Text className="strength-text">{s}</Text>
                    <View className="strength-shine" />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 名字建议 - 列表样式 */}
          {photoAnalysis.nameSuggestions && (
            <View className="report-section suggestions-section">
              <View className="section-title-row">
                <View className="title-icon-wrap cyan">
                  <Star size={20} color="#00f5ff" />
                </View>
                <Text className="section-title">AI推荐名字</Text>
              </View>
              <View className="name-suggestions">
                {photoAnalysis.nameSuggestions.map((suggestion, idx) => (
                  <View key={idx} className="name-suggestion-item premium-suggestion">
                    <View className="suggestion-number">{idx + 1}</View>
                    <View className="suggestion-content">
                      <Text className="suggested-name">{suggestion.name}</Text>
                      <Text className="suggestion-reason">{suggestion.reason}</Text>
                    </View>
                    <Check size={18} color="#00f5ff" className="suggestion-check" />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 总结 - 高亮框 */}
          {photoAnalysis.summary && (
            <View className="report-summary premium-summary">
              <View className="summary-icon">
                <Brain size={24} color="#00f5ff" />
              </View>
              <Text className="summary-text">{photoAnalysis.summary}</Text>
              <View className="summary-glow" />
            </View>
          )}
        </View>
      )}
    </View>
  )

  const renderStep2 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">确认性格类型</Text>
        <Text className="step-desc">AI已根据分析推荐了性格类型，你可以调整</Text>
      </View>

      <View className="personality-grid">
        {personalities.map(p => {
          const Icon = p.icon
          const isSelected = selectedPersonality === p.id
          return (
            <View
              key={p.id}
              className={`personality-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSelectedPersonality(p.id)}
            >
              <View className={`personality-icon ${isSelected ? 'glow' : ''}`}>
                <View className={`personality-icon-bg ${isSelected ? 'animated' : ''}`} />
                <Icon size={28} color={isSelected ? '#00f5ff' : '#fff'} />
              </View>
              <Text className="personality-name">{p.name}</Text>
              <Text className="personality-desc">{p.desc}</Text>
              <View className="traits-list">
                {p.traits.map((trait, idx) => (
                  <View key={idx} className="trait-tag-wrap">
                    <Text key={idx} className="trait-tag">{trait}</Text>
                    {isSelected && <View className="trait-shine" />}
                  </View>
                ))}
              </View>
              {isSelected && (
                <View className="selected-badge animated-badge">
                  <Check size={16} color="#00f5ff" />
                </View>
              )}
              {isSelected && <View className="card-glow" />}
              {isSelected && <View className="card-pulse" />}
            </View>
          )
        })}
      </View>
    </View>
  )

  const renderStep3 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">选择核心能力</Text>
        <Text className="step-desc">从技能广场选择最多3个能力，打造专属助手</Text>
      </View>

      <View className="ability-grid">
        {abilities.map(a => {
          const Icon = a.icon
          const isSelected = selectedAbilities.includes(a.id)
          return (
            <View
              key={a.id}
              className={`ability-card ${isSelected ? 'selected' : ''}`}
              onClick={() => toggleAbility(a.id)}
            >
              <View className="ability-icon-wrap">
                <Icon size={32} color={isSelected ? '#ffffff' : '#06b6d4'} />
              </View>
              <Text className="ability-name">{a.name}</Text>
              <Text className="ability-desc">{a.desc}</Text>
              {isSelected && (
                <View className="ability-check">
                  <Check size={16} color="#ffffff" />
                </View>
              )}
            </View>
          )
        })}
      </View>

      <View className="selected-count">
        <Text className="count-text">已选择 {selectedAbilities.length}/3 个能力</Text>
      </View>
    </View>
  )

  // 步骤4: 形象风格
  const renderStep4 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">选择形象风格</Text>
        <Text className="step-desc">为你的AI分身选择独特的外观形象</Text>
      </View>

      <View className="appearance-grid">
        {appearanceStyles.map(s => {
          const Icon = s.icon
          const isSelected = appearanceStyle === s.id
          return (
            <View
              key={s.id}
              className={`appearance-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setAppearanceStyle(s.id)}
            >
              <View
                className={`appearance-preview ${isSelected ? 'animated' : ''}`}
                style={{
                  background: `linear-gradient(135deg, ${s.color}20 0%, ${s.color}08 100%)`,
                  borderColor: isSelected ? s.color : 'rgba(6, 182, 212, 0.15)'
                }}
              >
                <View className={`preview-icon-glow ${isSelected ? 'active' : ''}`} style={{ background: s.color }} />
                <Icon size={48} color={s.color} />
                {isSelected && <View className="preview-pulse" style={{ background: s.color }} />}
              </View>
              <Text className="appearance-name">{s.name}</Text>
              <Text className="appearance-desc">{s.desc}</Text>
              {isSelected && (
                <View className="appearance-check animated-check" style={{ backgroundColor: s.color }}>
                  <Check size={18} color="#ffffff" />
                  <View className="check-shine" style={{ background: s.color }} />
                </View>
              )}
              {isSelected && <View className="appearance-card-glow" style={{ borderColor: s.color }} />}
            </View>
          )
        })}
      </View>
    </View>
  )

  // 步骤5: 说话方式
  const renderStep5 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">选择说话方式</Text>
        <Text className="step-desc">决定你的AI分身如何与你沟通</Text>
      </View>

      <View className="speaking-grid">
        {speakingStyles.map(s => {
          const Icon = s.icon
          const isSelected = speakingStyle === s.id
          return (
            <View
              key={s.id}
              className={`speaking-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setSpeakingStyle(s.id)}
            >
              <View className={`speaking-header ${isSelected ? 'animated' : ''}`}>
                <View className="speaking-icon-wrap">
                  <View className={`icon-glow ${isSelected ? 'active' : ''}`} />
                  <Icon size={28} color={isSelected ? '#06b6d4' : '#94a3b8'} />
                </View>
                <View className="speaking-info">
                  <Text className="speaking-name">{s.name}</Text>
                  <Text className="speaking-desc">{s.desc}</Text>
                </View>
                {isSelected && (
                  <View className="speaking-check animated-check">
                    <Check size={18} color="#06b6d4" />
                  </View>
                )}
              </View>
              <View className="speaking-example">
                <View className="example-bg" />
                <Text className="example-text">&ldquo;{s.example}&rdquo;</Text>
              </View>
              {isSelected && <View className="speaking-glow" />}
              {isSelected && <View className="speaking-pulse" />}
            </View>
          )
        })}
      </View>
    </View>
  )

  const renderStep6 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">为分身命名</Text>
        <Text className="step-desc">给AI分身一个特别的名字吧</Text>
      </View>

      <View className="name-section">
        <View className="avatar-preview">
          <View className="preview-glow" />
          {photoPath ? (
            <Image src={photoPath} className="preview-avatar-img" mode="aspectFill" />
          ) : (
            <User size={64} color="#00f5ff" />
          )}
        </View>

        <View className="name-input-wrap">
          <Input
            className="name-input"
            placeholder="输入分身名称..."
            value={avatarName}
            onInput={e => setAvatarName(e.detail.value)}
            maxlength={12}
          />
        </View>

        {photoAnalysis?.nameSuggestions && (
          <View className="name-suggestions-box">
            <Text className="suggestions-title">AI推荐名字</Text>
            <View className="suggestions-list">
              {photoAnalysis.nameSuggestions.slice(0, 4).map((s, idx) => (
                <View 
                  key={idx} 
                  className="suggestion-tag"
                  onClick={() => setAvatarName(s.name)}
                >
                  <Text className="suggestion-text">{s.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View className="summary-card">
          <Text className="summary-title">分身配置</Text>
          <View className="summary-item">
            <Text className="summary-label">气质：</Text>
            <Text className="summary-value">{photoAnalysis?.temperament?.type || '未分析'}</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-label">性格：</Text>
            <Text className="summary-value">{personalities.find(p => p.id === selectedPersonality)?.name || '未选择'}</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-label">能力：</Text>
            <Text className="summary-value">
              {selectedAbilities.map(id => abilities.find(a => a.id === id)?.name).filter(Boolean).join('、') || '未选择'}
            </Text>
          </View>
          <View className="summary-item">
            <Text className="summary-label">形象：</Text>
            <Text className="summary-value">{appearanceStyles.find(s => s.id === appearanceStyle)?.name || '未选择'}</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-label">语风：</Text>
            <Text className="summary-value">{speakingStyles.find(s => s.id === speakingStyle)?.name || '未选择'}</Text>
          </View>
        </View>
      </View>
    </View>
  )

  const canNext = () => {
    switch (step) {
      case 0: return !!photoPath && !analyzing
      case 1: return true // 分析结果页可以直接下一步
      case 2: return !!selectedPersonality
      case 3: return selectedAbilities.length > 0
      case 4: return !!appearanceStyle
      case 5: return !!speakingStyle
      case 6: return !!avatarName.trim()
      default: return false
    }
  }

  if (!isLoggedIn) return null

  return (
    <View className="page-container">
      {/* 漂浮粒子效果 */}
      <View className="floating-particle particle-1" />
      <View className="floating-particle particle-2" />
      <View className="floating-particle particle-3" />
      <View className="floating-particle particle-4" />

      {/* 头部 */}
      <View className="page-header">
        <View className="header-top">
          <View className="header-info">
            <Text className="header-title">创建AI分身</Text>
            <Text className="header-subtitle">上传照片，AI为你生成分身</Text>
          </View>
        </View>

        {/* 进度条 */}
        <View className="progress-bar">
          <View className="progress-fill" style={{ width: `${(step / 6) * 100}%` }} />
        </View>
        <View className="progress-steps">
          <View className={`step-indicator ${step >= 0 ? 'active' : ''} ${step > 0 ? 'completed' : ''}`}>
            <View className="step-dot" />
            <Text>上传</Text>
          </View>
          <View className={`step-indicator ${step >= 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <View className="step-dot" />
            <Text>分析</Text>
          </View>
          <View className={`step-indicator ${step >= 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <View className="step-dot" />
            <Text>性格</Text>
          </View>
          <View className={`step-indicator ${step >= 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
            <View className="step-dot" />
            <Text>能力</Text>
          </View>
          <View className={`step-indicator ${step >= 4 ? 'active' : ''} ${step > 4 ? 'completed' : ''}`}>
            <View className="step-dot" />
            <Text>形象</Text>
          </View>
          <View className={`step-indicator ${step >= 5 ? 'active' : ''} ${step > 5 ? 'completed' : ''}`}>
            <View className="step-dot" />
            <Text>说话</Text>
          </View>
          <View className={`step-indicator ${step >= 6 ? 'active' : ''}`}>
            <View className="step-dot" />
            <Text>命名</Text>
          </View>
        </View>
      </View>

      {/* 步骤内容 */}
      <ScrollView className="content-scroll" scrollY>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="bottom-bar">
        <View className="action-buttons">
          {step > 0 && (
            <Button className="action-btn btn-secondary" onClick={() => setStep(step - 1)}>
              <Text>上一步</Text>
            </Button>
          )}
          {step < 6 ? (
            <Button
              className={`action-btn ${canNext() ? 'btn-primary' : 'btn-disabled'}`}
              onClick={() => canNext() && setStep(step + 1)}
              disabled={!canNext()}
            >
              <Text>下一步</Text>
              {canNext() && <ArrowRight size={18} color="#fff" />}
            </Button>
          ) : (
            <Button
              className={`action-btn ${canNext() ? 'btn-primary' : 'btn-disabled'}`}
              onClick={handleCreate}
              disabled={!canNext() || loading}
            >
              {canNext() && <Sparkles size={18} color="#fff" />}
              <Text>{loading ? '创建中...' : '创建分身'}</Text>
            </Button>
          )}
        </View>
      </View>
    </View>
  )
}
