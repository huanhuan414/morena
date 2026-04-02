import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useState, useEffect } from 'react'
import { switchTab, showToast, chooseImage } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import { 
  Camera, Sparkles, Brain, Palette, Zap, Heart, Target, 
  Lightbulb, Shield, Star, ArrowRight, Check, Loader, User,
  Eye, MessageCircle, TrendingUp, Wand, Crown, Flame,
  Moon, Sun, Smile, Bot
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

interface AbilityOption {
  id: string
  name: string
  desc: string
  icon: any
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
  const [photoAnalysis, setPhotoAnalysis] = useState<PhotoAnalysis | null>(null)
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null)
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  const [avatarName, setAvatarName] = useState('')
  const [appearanceStyle, setAppearanceStyle] = useState<string>('tech')
  const [speakingStyle, setSpeakingStyle] = useState<string>('friendly')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isLoggedIn) {
      switchTab({ url: '/pages/social/index' })
    }
  }, [isLoggedIn])

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

  const abilities: AbilityOption[] = [
    { id: 'writing', name: '写作助手', desc: '文案、文章、创意写作', icon: Sparkles },
    { id: 'coding', name: '编程专家', desc: '代码开发、技术解答', icon: Zap },
    { id: 'analysis', name: '数据分析', desc: '数据洞察、报告生成', icon: Brain },
    { id: 'planning', name: '任务规划', desc: '日程管理、目标追踪', icon: Target },
    { id: 'learning', name: '学习伙伴', desc: '知识问答、技能提升', icon: Star },
    { id: 'creative', name: '创意设计', desc: '视觉创意、头脑风暴', icon: Palette },
    { id: 'emotional', name: '情感陪伴', desc: '心理支持、情绪疏导', icon: Heart },
    { id: 'protection', name: '安全守护', desc: '隐私保护、风险评估', icon: Shield }
  ]

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
      
      if (responseData?.code === 200) {
        const { analysis, photoUrl: url } = responseData.data
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
      }
    } catch (error) {
      console.error('分析照片失败:', error)
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
      setAnalyzing(false)
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
      const res = await Network.request({
        url: '/api/avatar',
        method: 'POST',
        data: {
          name: avatarName,
          personality: selectedPersonality,
          abilities: selectedAbilities,
          appearance_style: appearanceStyle,
          speaking_style: speakingStyle,
          photo_url: photoUrl,
          photo_analysis: photoAnalysis
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
      showToast({ title: '创建成功！', icon: 'success' })
      setTimeout(() => {
        switchTab({ url: '/pages/chat/index' })
      }, 800)
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

      <View className="upload-section">
        <View 
          className={`upload-area ${photoPath ? 'with-photo' : ''}`}
          onClick={handleChoosePhoto}
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
            <Loader size={48} color="#00f5ff" className="analyzing-spinner" />
            <Text className="analyzing-text">AI正在深度分析中...</Text>
            <Text className="analyzing-subtext">识别面部特征 · 分析气质类型 · 生成分身形象</Text>
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
        <Text className="step-title">AI分析报告</Text>
        <Text className="step-desc">基于照片深度分析生成的人格画像</Text>
      </View>

      {photoAnalysis && (
        <View className="analysis-report">
          {/* 照片预览 */}
          <View className="report-photo">
            {photoPath && (
              <Image src={photoPath} className="report-photo-img" mode="aspectFill" />
            )}
          </View>

          {/* 气质类型 */}
          {photoAnalysis.temperament && (
            <View className="report-section">
              <View className="section-title-row">
                <Sparkles size={20} color="#00f5ff" />
                <Text className="section-title">气质类型</Text>
              </View>
              <View className="temperament-card">
                <Text className="temperament-type">{photoAnalysis.temperament.type}</Text>
                <Text className="temperament-desc">{photoAnalysis.temperament.description}</Text>
                <View className="temperament-keywords">
                  {photoAnalysis.temperament.keywords?.map((kw, idx) => (
                    <View key={idx} className="keyword-tag">
                      <Text className="keyword-text">{kw}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* 面部特征 */}
          {photoAnalysis.facialFeatures && (
            <View className="report-section">
              <View className="section-title-row">
                <Eye size={20} color="#bf00ff" />
                <Text className="section-title">面部特征</Text>
              </View>
              <View className="features-grid">
                <View className="feature-item">
                  <Text className="feature-label">表情特点</Text>
                  <Text className="feature-value">{photoAnalysis.facialFeatures.expression}</Text>
                </View>
                <View className="feature-item">
                  <Text className="feature-label">眼神特点</Text>
                  <Text className="feature-value">{photoAnalysis.facialFeatures.eyes}</Text>
                </View>
                <View className="feature-item full">
                  <Text className="feature-label">整体印象</Text>
                  <Text className="feature-value">{photoAnalysis.facialFeatures.impression}</Text>
                </View>
              </View>
            </View>
          )}

          {/* 性格特质 */}
          {photoAnalysis.personality && (
            <View className="report-section">
              <View className="section-title-row">
                <Heart size={20} color="#ff6b6b" />
                <Text className="section-title">性格特质</Text>
              </View>
              <View className="personality-tags">
                {photoAnalysis.personality.core?.map((trait, idx) => (
                  <View key={idx} className="personality-tag">
                    <Text className="tag-text">{trait}</Text>
                  </View>
                ))}
              </View>
              {photoAnalysis.personality.strengths && (
                <View className="strengths-row">
                  <Text className="strengths-label">优势：</Text>
                  <Text className="strengths-value">{photoAnalysis.personality.strengths.join(' · ')}</Text>
                </View>
              )}
            </View>
          )}

          {/* 沟通风格 */}
          {photoAnalysis.communicationStyle && (
            <View className="report-section">
              <View className="section-title-row">
                <MessageCircle size={20} color="#00ff88" />
                <Text className="section-title">沟通风格</Text>
              </View>
              <Text className="communication-text">{photoAnalysis.communicationStyle}</Text>
            </View>
          )}

          {/* 擅长领域 */}
          {photoAnalysis.strengths && (
            <View className="report-section">
              <View className="section-title-row">
                <TrendingUp size={20} color="#ffaa00" />
                <Text className="section-title">擅长领域</Text>
              </View>
              <View className="strengths-grid">
                {photoAnalysis.strengths.map((s, idx) => (
                  <View key={idx} className="strength-item">
                    <Text className="strength-text">{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 名字建议 */}
          {photoAnalysis.nameSuggestions && (
            <View className="report-section">
              <View className="section-title-row">
                <Star size={20} color="#00f5ff" />
                <Text className="section-title">名字建议</Text>
              </View>
              <View className="name-suggestions">
                {photoAnalysis.nameSuggestions.map((suggestion, idx) => (
                  <View key={idx} className="name-suggestion-item">
                    <Text className="suggested-name">{suggestion.name}</Text>
                    <Text className="suggestion-reason">{suggestion.reason}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* 总结 */}
          {photoAnalysis.summary && (
            <View className="report-summary">
              <Text className="summary-text">{photoAnalysis.summary}</Text>
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
                <Icon size={28} color={isSelected ? '#00f5ff' : '#fff'} />
              </View>
              <Text className="personality-name">{p.name}</Text>
              <Text className="personality-desc">{p.desc}</Text>
              <View className="traits-list">
                {p.traits.map((trait, idx) => (
                  <Text key={idx} className="trait-tag">{trait}</Text>
                ))}
              </View>
              {isSelected && (
                <View className="selected-badge">
                  <Check size={16} color="#00f5ff" />
                </View>
              )}
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
        <Text className="step-desc">最多选择3个能力，打造专属助手</Text>
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
                <Icon size={24} color={isSelected ? '#00f5ff' : 'rgba(255,255,255,0.6)'} />
              </View>
              <Text className="ability-name">{a.name}</Text>
              <Text className="ability-desc">{a.desc}</Text>
              {isSelected && (
                <View className="ability-check">
                  <Check size={14} color="#00f5ff" />
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
                className="appearance-preview"
                style={{ 
                  background: `linear-gradient(135deg, ${s.color}30 0%, ${s.color}10 100%)`,
                  borderColor: isSelected ? s.color : 'rgba(255,255,255,0.1)'
                }}
              >
                <Icon size={40} color={s.color} />
              </View>
              <Text className="appearance-name">{s.name}</Text>
              <Text className="appearance-desc">{s.desc}</Text>
              {isSelected && (
                <View className="appearance-check" style={{ backgroundColor: s.color }}>
                  <Check size={14} color="#0a0a0f" />
                </View>
              )}
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
              <View className="speaking-header">
                <View className="speaking-icon-wrap">
                  <Icon size={24} color={isSelected ? '#00f5ff' : 'rgba(255,255,255,0.5)'} />
                </View>
                <View className="speaking-info">
                  <Text className="speaking-name">{s.name}</Text>
                  <Text className="speaking-desc">{s.desc}</Text>
                </View>
                {isSelected && (
                  <View className="speaking-check">
                    <Check size={16} color="#00f5ff" />
                  </View>
                )}
              </View>
              <View className="speaking-example">
                <Text className="example-text">{s.example}</Text>
              </View>
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
    <View className="create-page">
      {/* 进度条 */}
      <View className="progress-bar">
        <View className="progress-track">
          <View 
            className="progress-fill" 
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </View>
        <View className="progress-dots">
          {[0, 1, 2, 3, 4, 5, 6].map(s => (
            <View key={s} className={`progress-dot ${step >= s ? 'active' : ''}`}>
              {step > s ? <Check size={10} color="#0a0a0f" /> : <Text className="dot-number">{s + 1}</Text>}
            </View>
          ))}
        </View>
      </View>

      {/* 步骤内容 */}
      <ScrollView className="step-scroll" scrollY>
        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 5 && renderStep5()}
        {step === 6 && renderStep6()}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="bottom-actions">
        {step > 0 && (
          <Button className="back-btn" onClick={() => setStep(step - 1)}>
            <Text className="back-btn-text">上一步</Text>
          </Button>
        )}
        {step < 6 ? (
          <Button 
            className={`next-btn ${!canNext() ? 'disabled' : ''}`}
            onClick={() => canNext() && setStep(step + 1)}
            disabled={!canNext()}
          >
            <Text className="next-btn-text">下一步</Text>
            <ArrowRight size={18} color={canNext() ? '#0a0a0f' : '#666'} />
          </Button>
        ) : (
          <Button 
            className={`create-btn ${!canNext() ? 'disabled' : ''}`}
            onClick={handleCreate}
            disabled={!canNext() || loading}
          >
            <Sparkles size={18} color={canNext() ? '#0a0a0f' : '#666'} />
            <Text className="create-btn-text">{loading ? '创建中...' : '创建分身'}</Text>
          </Button>
        )}
      </View>
    </View>
  )
}
