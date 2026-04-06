import * as React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { X, Star, MessageCircle, TrendingUp, ShoppingCart } from 'lucide-react-taro'
import { cn } from '@/lib/utils'

interface LevelInfo {
  level: number
  minExp: number
  maxExp: number
  title: string
  benefits: string[]
  expSources: { icon: React.ReactElement; desc: string; expRange: string }[]
  color: string
}

const LEVEL_DATA: LevelInfo[] = [
  {
    level: 1,
    minExp: 0,
    maxExp: 100,
    title: '初识',
    benefits: ['基础对话能力', '简单的问答互动'],
    expSources: [
      { icon: <MessageCircle size={14} color="#94a3b8" />, desc: '与分身对话', expRange: '+5~6 XP/次' },
      { icon: <TrendingUp size={14} color="#94a3b8" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#94a3b8'
  },
  {
    level: 2,
    minExp: 100,
    maxExp: 200,
    title: '熟悉',
    benefits: ['更流畅的对话', '基础记忆能力'],
    expSources: [
      { icon: <MessageCircle size={14} color="#22c55e" />, desc: '与分身对话', expRange: '+7~8 XP/次' },
      { icon: <TrendingUp size={14} color="#22c55e" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#22c55e'
  },
  {
    level: 3,
    minExp: 200,
    maxExp: 300,
    title: '信任',
    benefits: ['记住重要信息', '情绪识别能力'],
    expSources: [
      { icon: <MessageCircle size={14} color="#3b82f6" />, desc: '与分身对话', expRange: '+9~10 XP/次' },
      { icon: <TrendingUp size={14} color="#3b82f6" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#3b82f6'
  },
  {
    level: 4,
    minExp: 300,
    maxExp: 400,
    title: '默契',
    benefits: ['更好的理解', '习惯记忆'],
    expSources: [
      { icon: <MessageCircle size={14} color="#8b5cf6" />, desc: '与分身对话', expRange: '+11~12 XP/次' },
      { icon: <TrendingUp size={14} color="#8b5cf6" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#8b5cf6'
  },
  {
    level: 5,
    minExp: 400,
    maxExp: 500,
    title: '知己',
    benefits: ['风格学习', '个性化回复'],
    expSources: [
      { icon: <MessageCircle size={14} color="#ec4899" />, desc: '与分身对话', expRange: '+13~14 XP/次' },
      { icon: <TrendingUp size={14} color="#ec4899" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#ec4899'
  },
  {
    level: 6,
    minExp: 500,
    maxExp: 600,
    title: '心意相通',
    benefits: ['情感共鸣', '主动关心'],
    expSources: [
      { icon: <MessageCircle size={14} color="#f97316" />, desc: '与分身对话', expRange: '+20~21 XP/次' },
      { icon: <TrendingUp size={14} color="#f97316" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#f97316'
  },
  {
    level: 7,
    minExp: 600,
    maxExp: 700,
    title: '灵魂伴侣',
    benefits: ['深度理解', '默契配合'],
    expSources: [
      { icon: <MessageCircle size={14} color="#ef4444" />, desc: '与分身对话', expRange: '+25~26 XP/次' },
      { icon: <TrendingUp size={14} color="#ef4444" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#ef4444'
  },
  {
    level: 8,
    minExp: 700,
    maxExp: 800,
    title: '完美契合',
    benefits: ['无需言表', '心有灵犀'],
    expSources: [
      { icon: <MessageCircle size={14} color="#eab308" />, desc: '与分身对话', expRange: '+30~31 XP/次' },
      { icon: <TrendingUp size={14} color="#eab308" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#eab308'
  },
  {
    level: 9,
    minExp: 800,
    maxExp: 900,
    title: '知心',
    benefits: ['无需言表', '心有灵犀'],
    expSources: [
      { icon: <MessageCircle size={14} color="#06b6d4" />, desc: '与分身对话', expRange: '+35~36 XP/次' },
      { icon: <TrendingUp size={14} color="#06b6d4" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#06b6d4'
  },
  {
    level: 10,
    minExp: 900,
    maxExp: 1000,
    title: '合一',
    benefits: ['完美契合', '超越语言'],
    expSources: [
      { icon: <MessageCircle size={14} color="#a855f7" />, desc: '与分身对话', expRange: '+40~41 XP/次' },
      { icon: <TrendingUp size={14} color="#a855f7" />, desc: '完成任务/订单', expRange: '+30~65 XP/次' }
    ],
    color: '#a855f7'
  }
]

const ALL_LEVELS = LEVEL_DATA

interface LevelDetailDialogProps {
  open: boolean
  onClose: () => void
  currentLevel: number
  currentExp: number
}

export function LevelDetailDialog({ open, onClose, currentLevel, currentExp }: LevelDetailDialogProps) {
  const [activeTab, setActiveTab] = React.useState<'level' | 'guide'>('level')

  if (!open) return null

  const currentLevelData = ALL_LEVELS[currentLevel - 1] || ALL_LEVELS[0]
  const progressPercent = Math.min(100, ((currentExp - (currentLevel - 1) * 100) / 100) * 100)

  return (
    <View className="level-modal-overlay" onClick={onClose}>
      <View className="level-modal-content" onClick={e => e.stopPropagation()}>
        {/* 头部 */}
        <View className="level-modal-header">
          <View className="level-modal-title-row">
            <View className="level-modal-icon">
              <Star size={24} color="#eab308" />
            </View>
            <Text className="level-modal-title">等级详情</Text>
          </View>
          <View className="level-modal-close" onClick={onClose}>
            <X size={20} color="#666" />
          </View>
        </View>

        {/* 当前状态 */}
        <View className="level-modal-status">
          <View className="level-modal-badge" style={{ backgroundColor: currentLevelData.color }}>
            <Text className="level-modal-badge-text">Lv.{currentLevel}</Text>
          </View>
          <View className="level-modal-info">
            <Text className="level-modal-title-text">{currentLevelData.title}</Text>
            <Text className="level-modal-exp">{currentExp} / {currentLevel * 100} XP</Text>
          </View>
          <View className="level-modal-progress">
            <View 
              className="level-modal-progress-fill" 
              style={{ 
                width: `${progressPercent}%`,
                backgroundColor: currentLevelData.color
              }} 
            />
          </View>
          <Text className="level-modal-hint">
            升级方式：累计经验值达到 {currentLevel * 100} XP 即可升级
          </Text>
        </View>

        {/* Tab切换 */}
        <View className="level-modal-tabs">
          <View 
            className={cn('level-modal-tab', activeTab === 'level' && 'level-modal-tab-active')}
            onClick={() => setActiveTab('level')}
          >
            <Text className={cn('level-modal-tab-text', activeTab === 'level' && 'level-modal-tab-text-active')}>等级权益</Text>
          </View>
          <View 
            className={cn('level-modal-tab', activeTab === 'guide' && 'level-modal-tab-active')}
            onClick={() => setActiveTab('guide')}
          >
            <Text className={cn('level-modal-tab-text', activeTab === 'guide' && 'level-modal-tab-text-active')}>升级攻略</Text>
          </View>
        </View>

        {/* 内容区 */}
        <ScrollView className="level-modal-scroll" scrollY>
          {activeTab === 'level' ? (
            <View className="level-modal-list">
              {ALL_LEVELS.map((level) => (
                <View 
                  key={level.level}
                  className={cn('level-modal-item', level.level === currentLevel && 'level-modal-item-current')}
                >
                  <View className="level-modal-item-header">
                    <View className="level-modal-item-badge" style={{ backgroundColor: level.color }}>
                      <Text className="level-modal-item-badge-text">Lv.{level.level}</Text>
                    </View>
                    <View className="level-modal-item-info">
                      <Text className="level-modal-item-title">{level.title}</Text>
                      <Text className="level-modal-item-exp">{level.minExp} - {level.maxExp} XP</Text>
                    </View>
                    {level.level < currentLevel && (
                      <View className="level-modal-item-done">
                        <Text className="level-modal-item-done-text">已达成</Text>
                      </View>
                    )}
                  </View>
                  <View className="level-modal-benefits">
                    {level.benefits.map((benefit, idx) => (
                      <View key={idx} className="level-modal-benefit-item">
                        <Star size={12} color={level.color} />
                        <Text className="level-modal-benefit-text">{benefit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="level-modal-guide">
              <View className="guide-section">
                <Text className="guide-title">经验值来源</Text>
                <View className="guide-item">
                  <View className="guide-icon-wrap" style={{ backgroundColor: '#3b82f615' }}>
                    <MessageCircle size={18} color="#3b82f6" />
                  </View>
                  <View className="guide-content">
                    <Text className="guide-item-title">与分身对话</Text>
                    <Text className="guide-item-desc">
                      Lv.1-5: 5-13 XP/次 | Lv.6-10: 20-40 XP/次{'\n'}
                      消息超过50字额外+1 XP，超过200字每100字再+1
                    </Text>
                  </View>
                </View>
                <View className="guide-item">
                  <View className="guide-icon-wrap" style={{ backgroundColor: '#22c55e15' }}>
                    <TrendingUp size={18} color="#22c55e" />
                  </View>
                  <View className="guide-content">
                    <Text className="guide-item-title">完成任务</Text>
                    <Text className="guide-item-desc">
                      基础 30 XP{'\n'}
                      高优先级+15 | Agent任务+20 | 复杂任务+15
                    </Text>
                  </View>
                </View>
                <View className="guide-item">
                  <View className="guide-icon-wrap" style={{ backgroundColor: '#ec489915' }}>
                    <ShoppingCart size={18} color="#ec4899" />
                  </View>
                  <View className="guide-content">
                    <Text className="guide-item-title">完成订单</Text>
                    <Text className="guide-item-desc">
                      基础 30 XP{'\n'}
                      预算每100元额外+5 XP，上限+50
                    </Text>
                  </View>
                </View>
              </View>

              <View className="guide-section">
                <Text className="guide-title">各等级升级攻略</Text>
                {ALL_LEVELS.map((level) => (
                  <View 
                    key={level.level}
                    className={cn('guide-level-item', level.level === currentLevel && 'guide-level-current')}
                  >
                    <View className="guide-level-header">
                      <View className="guide-level-badge" style={{ backgroundColor: level.color }}>
                        <Text className="guide-level-badge-text">Lv.{level.level}</Text>
                      </View>
                      <Text className="guide-level-title">{level.title}</Text>
                    </View>
                    <View className="guide-level-sources">
                      {level.expSources.map((source, idx) => (
                        <View key={idx} className="guide-source-item">
                          <View style={{ color: level.color }}>{source.icon}</View>
                          <Text className="guide-source-desc">{source.desc}</Text>
                          <Text className="guide-source-exp">{source.expRange}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </View>
  )
}
