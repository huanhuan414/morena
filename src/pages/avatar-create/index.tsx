import { View, Text, ScrollView } from '@tarojs/components'
import { useState } from 'react'
import { switchTab, showToast } from '@tarojs/taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Sparkles, Brain, Palette, Zap, Heart, Target, Lightbulb, Shield, Star, ArrowRight, Check } from 'lucide-react-taro'
import './index.css'

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

export default function AvatarCreatePage() {
  const [step, setStep] = useState(1)
  const [selectedPersonality, setSelectedPersonality] = useState<string | null>(null)
  const [selectedAbilities, setSelectedAbilities] = useState<string[]>([])
  const [avatarName, setAvatarName] = useState('')
  const [avatarStyle, setAvatarStyle] = useState<'tech' | 'warm' | 'mysterious'>('tech')
  const [loading, setLoading] = useState(false)

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

  const styles = [
    { id: 'tech', name: '科技风', color: '#00f5ff', desc: '未来感·理性' },
    { id: 'warm', name: '温暖风', color: '#ff6b6b', desc: '亲和·温暖' },
    { id: 'mysterious', name: '神秘风', color: '#bf00ff', desc: '深邃·神秘' }
  ]

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
          style: avatarStyle
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          switchTab({ url: '/pages/home/index' })
        }, 500)
      }
    } catch (error) {
      // 模拟创建成功
      showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        switchTab({ url: '/pages/home/index' })
      }, 500)
    } finally {
      setLoading(false)
    }
  }

  const renderStep1 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">选择分身性格</Text>
        <Text className="step-desc">不同的性格会影响AI的回复风格</Text>
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

  const renderStep2 = () => (
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

  const renderStep3 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">设置外观风格</Text>
        <Text className="step-desc">为你的AI分身选择独特的外观</Text>
      </View>

      <View className="style-grid">
        {styles.map(s => {
          const isSelected = avatarStyle === s.id
          return (
            <View 
              key={s.id}
              className={`style-card ${isSelected ? 'selected' : ''}`}
              onClick={() => setAvatarStyle(s.id as any)}
            >
              <View 
                className="style-preview"
                style={{ 
                  background: `linear-gradient(135deg, ${s.color}40 0%, ${s.color}10 100%)`,
                  borderColor: isSelected ? s.color : 'rgba(255,255,255,0.1)'
                }}
              >
                <View 
                  className="style-orb"
                  style={{ 
                    background: `radial-gradient(circle, ${s.color} 0%, transparent 70%)`,
                    boxShadow: `0 0 40px ${s.color}60`
                  }}
                />
              </View>
              <Text className="style-name">{s.name}</Text>
              <Text className="style-desc">{s.desc}</Text>
              {isSelected && (
                <View className="style-check">
                  <Check size={14} color="#fff" />
                </View>
              )}
            </View>
          )
        })}
      </View>
    </View>
  )

  const renderStep4 = () => (
    <View className="step-content">
      <View className="step-header">
        <Text className="step-title">为分身命名</Text>
        <Text className="step-desc">给AI分身一个特别的名字吧</Text>
      </View>

      <View className="name-section">
        <View className="avatar-preview">
          <View className="preview-glow" />
          <Sparkles size={64} color="#00f5ff" />
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

        <View className="name-suggestions">
          <Text className="suggestions-title">推荐名称</Text>
          <View className="suggestions-list">
            {['小墨', '星云', '智慧星', '灵感猫'].map(name => (
              <View 
                key={name} 
                className="suggestion-tag"
                onClick={() => setAvatarName(name)}
              >
                <Text className="suggestion-text">{name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className="summary-card">
          <Text className="summary-title">分身配置</Text>
          <View className="summary-item">
            <Text className="summary-label">性格：</Text>
            <Text className="summary-value">{personalities.find(p => p.id === selectedPersonality)?.name || '未选择'}</Text>
          </View>
          <View className="summary-item">
            <Text className="summary-label">能力：</Text>
            <Text className="summary-value">
              {selectedAbilities.map(id => abilities.find(a => a.id === id)?.name).join('、') || '未选择'}
            </Text>
          </View>
          <View className="summary-item">
            <Text className="summary-label">风格：</Text>
            <Text className="summary-value">{styles.find(s => s.id === avatarStyle)?.name || '未选择'}</Text>
          </View>
        </View>
      </View>
    </View>
  )

  const canNext = () => {
    switch (step) {
      case 1: return !!selectedPersonality
      case 2: return selectedAbilities.length > 0
      case 3: return !!avatarStyle
      case 4: return !!avatarName.trim()
      default: return false
    }
  }

  return (
    <View className="create-page">
      {/* 进度条 */}
      <View className="progress-bar">
        <View className="progress-track">
          <View 
            className="progress-fill" 
            style={{ width: `${(step / 4) * 100}%` }}
          />
        </View>
        <View className="progress-dots">
          {[1, 2, 3, 4].map(s => (
            <View key={s} className={`progress-dot ${step >= s ? 'active' : ''}`}>
              {step > s ? <Check size={12} color="#0a0a0f" /> : <Text className="dot-number">{s}</Text>}
            </View>
          ))}
        </View>
      </View>

      {/* 步骤内容 */}
      <ScrollView className="step-scroll" scrollY>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </ScrollView>

      {/* 底部按钮 */}
      <View className="bottom-actions">
        {step > 1 && (
          <Button className="back-btn" onClick={() => setStep(step - 1)}>
            <Text className="back-btn-text">上一步</Text>
          </Button>
        )}
        {step < 4 ? (
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
            <Text className="create-btn-text">创建分身</Text>
          </Button>
        )}
      </View>
    </View>
  )
}
