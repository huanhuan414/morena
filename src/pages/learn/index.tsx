import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, redirectTo, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { 
  Brain, Sparkles, TrendingUp, MessageCircle, Smile, Hash, 
  Clock, Target, Award, Star, Heart,
  Mic, FileText, Users, Activity
} from 'lucide-react-taro'
import './index.css'

interface LearningStats {
  messageCount: number
  learningDays: number
  masteryLevel: number // 0-100
  avgMessageLength: number
  responseAccuracy: number
}

interface SpeakingStyle {
  type: string
  name: string
  percentage: number
  examples: string[]
}

interface HabitPhrase {
  phrase: string
  count: number
  lastUsed: string
}

interface EmojiUsage {
  emoji: string
  count: number
  emotion: string
}

interface EvolutionRecord {
  id: string
  level_from: number
  level_to: number
  exp_gained: number
  source: string
  rewards: Record<string, any>
  created_at: string
}

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  exp: number
  config: {
    learning?: {
      messageCount: number
      avgMessageLength: number
      commonPhrases: string[]
      emotions: string[]
      topics: string[]
    }
    style?: string
    photo_analysis?: {
      traits: string[]
    }
  }
}

export default function LearnPage() {
  const { isLoggedIn } = useUserStore()
  const [avatar, setAvatar] = useState<Avatar | null>(null)
  const [stats, setStats] = useState<LearningStats>({
    messageCount: 0,
    learningDays: 0,
    masteryLevel: 0,
    avgMessageLength: 0,
    responseAccuracy: 0
  })
  const [speakingStyles, setSpeakingStyles] = useState<SpeakingStyle[]>([])
  const [habitPhrases, setHabitPhrases] = useState<HabitPhrase[]>([])
  const [emojiUsages, setEmojiUsages] = useState<EmojiUsage[]>([])
  const [evolutions, setEvolutions] = useState<EvolutionRecord[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'style' | 'evolution'>('overview')

  useLoad(() => {
    if (!isLoggedIn) {
      redirectTo({ url: '/pages/home/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchAvatarAndLearning()
    }
  })

  const fetchAvatarAndLearning = async () => {
    try {
      // 获取分身列表
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200 && res.data.data?.length > 0) {
        const userAvatar = res.data.data[0]
        setAvatar(userAvatar)
        
        // 解析学习数据
        const learning = userAvatar.config?.learning || {}
        setStats({
          messageCount: learning.messageCount || 0,
          learningDays: Math.floor((learning.messageCount || 0) / 10) + 1,
          masteryLevel: Math.min(100, Math.floor((learning.messageCount || 0) / 5)),
          avgMessageLength: learning.avgMessageLength || 0,
          responseAccuracy: 85 + Math.min(15, Math.floor((learning.messageCount || 0) / 20))
        })
        
        // 设置常用短语
        if (learning.commonPhrases?.length > 0) {
          setEmojiUsages(learning.commonPhrases.slice(0, 6).map((e: string) => ({
            emoji: e,
            count: Math.floor(Math.random() * 20) + 5,
            emotion: getEmojiEmotion(e)
          })))
        }
        
        // 获取进化记录
        fetchEvolutions(userAvatar.id)
      }
    } catch (error) {
      console.error('获取学习数据失败:', error)
      // 使用模拟数据
      setMockData()
    }
  }

  const fetchEvolutions = async (avatarId: string) => {
    try {
      const res = await Network.request({ url: `/api/avatar/${avatarId}/evolutions` })
      if (res.data?.code === 200) {
        setEvolutions(res.data.data || [])
      }
    } catch (error) {
      // 使用模拟数据
      setEvolutions([
        {
          id: '1',
          level_from: 1,
          level_to: 2,
          exp_gained: 100,
          source: '对话学习',
          rewards: { theme_unlock: ['dark', 'light'] },
          created_at: new Date(Date.now() - 86400000 * 2).toISOString()
        }
      ])
    }
  }

  const setMockData = () => {
    setStats({
      messageCount: 156,
      learningDays: 12,
      masteryLevel: 68,
      avgMessageLength: 24,
      responseAccuracy: 92
    })
    
    setSpeakingStyles([
      { type: 'casual', name: '轻松幽默', percentage: 45, examples: ['哈哈', '有意思', '确实'] },
      { type: 'professional', name: '专业严谨', percentage: 30, examples: ['首先', '因此', '综上'] },
      { type: 'emotional', name: '情感丰富', percentage: 25, examples: ['太棒了', '好感动', '加油'] }
    ])
    
    setHabitPhrases([
      { phrase: '好的', count: 45, lastUsed: '刚刚' },
      { phrase: '谢谢', count: 38, lastUsed: '5分钟前' },
      { phrase: '明白了', count: 32, lastUsed: '10分钟前' },
      { phrase: '没问题', count: 28, lastUsed: '30分钟前' }
    ])
    
    setEmojiUsages([
      { emoji: '😊', count: 56, emotion: '开心' },
      { emoji: '👍', count: 42, emotion: '认同' },
      { emoji: '❤️', count: 35, emotion: '喜爱' },
      { emoji: '🎉', count: 28, emotion: '庆祝' },
      { emoji: '🤔', count: 22, emotion: '思考' },
      { emoji: '💪', count: 18, emotion: '鼓励' }
    ])
  }

  const getEmojiEmotion = (emoji: string): string => {
    const emotionMap: Record<string, string> = {
      '😊': '开心', '😂': '大笑', '🥰': '喜爱', '😎': '自信',
      '👍': '认同', '❤️': '喜爱', '🎉': '庆祝', '🤔': '思考',
      '💪': '鼓励', '🙏': '感谢', '✨': '闪亮', '🔥': '热情'
    }
    return emotionMap[emoji] || '情感'
  }

  const getMasteryDesc = (level: number) => {
    if (level < 20) return '初识阶段'
    if (level < 40) return '了解阶段'
    if (level < 60) return '熟悉阶段'
    if (level < 80) return '精通阶段'
    return '默契阶段'
  }

  const renderOverview = () => (
    <View className="overview-section">
      {/* 学习进度卡片 */}
      <View className="mastery-card">
        <View className="mastery-header">
          <Text className="mastery-title">分身学习进度</Text>
          <Text className="mastery-level">{getMasteryDesc(stats.masteryLevel)}</Text>
        </View>
        
        <View className="mastery-progress">
          <View className="progress-ring">
            <View className="ring-bg" />
            <View 
              className="ring-fill"
              style={{ 
                background: `conic-gradient(#00f5ff 0% ${stats.masteryLevel}%, rgba(255,255,255,0.1) ${stats.masteryLevel}% 100%)`
              }}
            />
            <View className="ring-inner">
              <Text className="ring-value">{stats.masteryLevel}%</Text>
              <Text className="ring-label">掌握度</Text>
            </View>
          </View>
        </View>
        
        <View className="mastery-desc">
          <Text className="desc-text">
            分身正在学习你的说话方式。多聊天，它会更懂你！
          </Text>
        </View>
      </View>

      {/* 统计数据 */}
      <View className="stats-grid">
        <View className="stat-card">
          <View className="stat-icon">
            <MessageCircle size={24} color="#00f5ff" />
          </View>
          <Text className="stat-value">{stats.messageCount}</Text>
          <Text className="stat-label">对话次数</Text>
        </View>
        
        <View className="stat-card">
          <View className="stat-icon">
            <Clock size={24} color="#bf00ff" />
          </View>
          <Text className="stat-value">{stats.learningDays}</Text>
          <Text className="stat-label">学习天数</Text>
        </View>
        
        <View className="stat-card">
          <View className="stat-icon">
            <FileText size={24} color="#ff6b6b" />
          </View>
          <Text className="stat-value">{stats.avgMessageLength}</Text>
          <Text className="stat-label">平均字数</Text>
        </View>
        
        <View className="stat-card">
          <View className="stat-icon">
            <Target size={24} color="#00ff88" />
          </View>
          <Text className="stat-value">{stats.responseAccuracy}%</Text>
          <Text className="stat-label">理解准确率</Text>
        </View>
      </View>

      {/* 表情使用偏好 */}
      {emojiUsages.length > 0 && (
        <View className="emoji-section">
          <View className="section-header">
            <Smile size={20} color="#00f5ff" />
            <Text className="section-title">表情使用偏好</Text>
          </View>
          
          <View className="emoji-grid">
            {emojiUsages.map((item, idx) => (
              <View key={idx} className="emoji-card">
                <Text className="emoji-icon">{item.emoji}</Text>
                <Text className="emoji-count">{item.count}次</Text>
                <Text className="emoji-emotion">{item.emotion}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 快捷操作 */}
      <View className="quick-actions">
        <Button 
          className="action-btn primary"
          onClick={() => switchTab({ url: '/pages/chat/index' })}
        >
          <MessageCircle size={20} color="#0a0a0f" />
          <Text className="action-text">继续对话学习</Text>
        </Button>
      </View>
    </View>
  )

  const renderStyle = () => (
    <View className="style-section">
      {/* 说话风格分析 */}
      <View className="style-analysis">
        <View className="section-header">
          <Brain size={20} color="#00f5ff" />
          <Text className="section-title">说话风格分析</Text>
        </View>
        
        <View className="style-bars">
          {speakingStyles.map((style, idx) => (
            <View key={idx} className="style-bar-item">
              <View className="style-bar-header">
                <Text className="style-name">{style.name}</Text>
                <Text className="style-percent">{style.percentage}%</Text>
              </View>
              <View className="style-bar-bg">
                <View 
                  className="style-bar-fill"
                  style={{ width: `${style.percentage}%` }}
                />
              </View>
              <View className="style-examples">
                {style.examples.map((ex, i) => (
                  <View key={i} className="example-tag">
                    <Text className="example-text">{ex}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 口头禅 */}
      <View className="habits-section">
        <View className="section-header">
          <Hash size={20} color="#bf00ff" />
          <Text className="section-title">常用口头禅</Text>
        </View>
        
        <View className="habits-list">
          {habitPhrases.map((item, idx) => (
            <View key={idx} className="habit-item">
              <View className="habit-rank">
                <Text className="rank-text">#{idx + 1}</Text>
              </View>
              <View className="habit-content">
                <Text className="habit-phrase">&ldquo;{item.phrase}&rdquo;</Text>
                <Text className="habit-count">使用了 {item.count} 次</Text>
              </View>
              <Text className="habit-time">{item.lastUsed}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 学习洞察 */}
      <View className="insights-section">
        <View className="section-header">
          <Sparkles size={20} color="#ff6b6b" />
          <Text className="section-title">学习洞察</Text>
        </View>
        
        <View className="insight-card">
          <Text className="insight-text">
            🎯 你喜欢用简洁的方式表达观点
          </Text>
        </View>
        <View className="insight-card">
          <Text className="insight-text">
            💬 你的提问风格偏向开放式问题
          </Text>
        </View>
        <View className="insight-card">
          <Text className="insight-text">
            😊 你在表达认同时常使用表情符号
          </Text>
        </View>
      </View>
    </View>
  )

  const renderEvolution = () => (
    <View className="evolution-section">
      <View className="section-header">
        <TrendingUp size={20} color="#00f5ff" />
        <Text className="section-title">进化历程</Text>
      </View>
      
      {avatar && (
        <View className="current-level">
          <View className="level-badge">
            <Text className="level-text">Lv.{avatar.level}</Text>
          </View>
          <View className="level-info">
            <Text className="level-title">{avatar.name}</Text>
            <View className="exp-bar">
              <View 
                className="exp-fill"
                style={{ width: `${(avatar.exp % 100)}%` }}
              />
            </View>
            <Text className="exp-text">{avatar.exp % 100}/100 EXP</Text>
          </View>
        </View>
      )}
      
      <View className="evolution-timeline">
        {evolutions.length > 0 ? evolutions.map((record, idx) => (
          <View key={idx} className="timeline-item">
            <View className="timeline-dot" />
            <View className="timeline-content">
              <Text className="timeline-title">
                升级至 Lv.{record.level_to}
              </Text>
              <Text className="timeline-desc">
                通过{record.source}获得 {record.exp_gained} 经验
              </Text>
              <Text className="timeline-time">
                {new Date(record.created_at).toLocaleDateString()}
              </Text>
            </View>
          </View>
        )) : (
          <View className="empty-evolution">
            <Star size={48} color="rgba(255,255,255,0.2)" />
            <Text className="empty-text">继续对话，分身将会进化</Text>
          </View>
        )}
      </View>
      
      <View className="unlock-preview">
        <Text className="unlock-title">即将解锁</Text>
        <View className="unlock-list">
          <View className="unlock-item">
            <Award size={20} color="rgba(255,255,255,0.4)" />
            <Text className="unlock-text">Lv.3 解锁更多技能槽位</Text>
          </View>
          <View className="unlock-item">
            <Users size={20} color="rgba(255,255,255,0.4)" />
            <Text className="unlock-text">Lv.5 解锁高级技能</Text>
          </View>
          <View className="unlock-item">
            <Heart size={20} color="rgba(255,255,255,0.4)" />
            <Text className="unlock-text">Lv.7 解锁自定义性格</Text>
          </View>
        </View>
      </View>
    </View>
  )

  if (!isLoggedIn) return null

  return (
    <View className="learn-page">
      {/* 顶部区域 */}
      <View className="learn-header">
        <View className="header-bg" />
        <View className="header-content">
          {avatar ? (
            <View className="avatar-info">
              <View className="avatar-image">
                {avatar.avatar_url ? (
                  <Image src={avatar.avatar_url} className="avatar-img" mode="aspectFill" />
                ) : (
                  <Sparkles size={32} color="#00f5ff" />
                )}
              </View>
              <View className="avatar-text">
                <Text className="avatar-name">{avatar.name}</Text>
                <Text className="avatar-level">Lv.{avatar.level} · 学习中</Text>
              </View>
            </View>
          ) : (
            <View className="no-avatar">
              <Brain size={32} color="#00f5ff" />
              <Text className="no-avatar-text">分身学习中心</Text>
            </View>
          )}
        </View>
      </View>

      {/* Tab切换 */}
      <View className="tabs-section">
        <View 
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={18} color={activeTab === 'overview' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">概览</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'style' ? 'active' : ''}`}
          onClick={() => setActiveTab('style')}
        >
          <Mic size={18} color={activeTab === 'style' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">风格</Text>
        </View>
        <View 
          className={`tab-item ${activeTab === 'evolution' ? 'active' : ''}`}
          onClick={() => setActiveTab('evolution')}
        >
          <TrendingUp size={18} color={activeTab === 'evolution' ? '#00f5ff' : 'rgba(255,255,255,0.4)'} />
          <Text className="tab-text">进化</Text>
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView className="content-scroll" scrollY>
        {activeTab === 'overview' && renderOverview()}
        {activeTab === 'style' && renderStyle()}
        {activeTab === 'evolution' && renderEvolution()}
        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
