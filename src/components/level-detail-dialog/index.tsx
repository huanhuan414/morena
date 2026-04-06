import * as React from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { X, Star, Zap, Brain, Heart, Users, MessageCircle, TrendingUp } from 'lucide-react-taro'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface LevelInfo {
  level: number
  minExp: number
  maxExp: number
  title: string
  benefits: string[]
  tasks: string[]
  color: string
}

const LEVEL_DATA: LevelInfo[] = [
  {
    level: 1,
    minExp: 0,
    maxExp: 100,
    title: '初识',
    benefits: ['基础对话能力', '简单的问答互动'],
    tasks: ['与分身进行10次对话', '完成新手引导'],
    color: '#94a3b8'
  },
  {
    level: 2,
    minExp: 100,
    maxExp: 200,
    title: '熟悉',
    benefits: ['更流畅的对话', '基础记忆能力'],
    tasks: ['每日与分身聊天', '分享3个兴趣爱好'],
    color: '#22c55e'
  },
  {
    level: 3,
    minExp: 200,
    maxExp: 300,
    title: '信任',
    benefits: ['记住重要信息', '情绪识别能力'],
    tasks: ['深度对话5次', '分享个人经历'],
    color: '#3b82f6'
  },
  {
    level: 4,
    minExp: 300,
    maxExp: 400,
    title: '默契',
    benefits: ['更好的理解', '习惯记忆'],
    tasks: ['连续7天互动', '让分身帮你做任务'],
    color: '#8b5cf6'
  },
  {
    level: 5,
    minExp: 400,
    maxExp: 500,
    title: '知己',
    benefits: ['风格学习', '个性化回复'],
    tasks: ['完成B端订单任务', '创建1个分身'],
    color: '#ec4899'
  },
  {
    level: 6,
    minExp: 500,
    maxExp: 600,
    title: '心意相通',
    benefits: ['情感共鸣', '主动关心'],
    tasks: ['分享工作/生活话题', '让分身参与决策'],
    color: '#f97316'
  },
  {
    level: 7,
    minExp: 600,
    maxExp: 700,
    title: '灵魂伴侣',
    benefits: ['深度理解', '默契配合'],
    tasks: ['100次深度对话', '解锁分身高级技能'],
    color: '#ef4444'
  },
  {
    level: 8,
    minExp: 700,
    maxExp: 800,
    title: '完美契合',
    benefits: ['心意相通', '预见需求'],
    tasks: ['分身等级达到Lv.8', '托管任务满7天'],
    color: '#eab308'
  },
  {
    level: 9,
    minExp: 800,
    maxExp: 900,
    title: '知心',
    benefits: ['无需言表', '心有灵犀'],
    tasks: ['200次对话', '完成所有学习任务'],
    color: '#06b6d4'
  },
  {
    level: 10,
    minExp: 900,
    maxExp: 1000,
    title: '合一',
    benefits: ['完美契合', '超越语言'],
    tasks: ['达到1000经验', '分身托管满30天'],
    color: '#a855f7'
  }
]

// 11-20级使用相同模板
const ADVANCED_LEVELS: LevelInfo[] = Array.from({ length: 10 }, (_, i) => {
  const level = i + 11
  return {
    level,
    minExp: level * 100,
    maxExp: (level + 1) * 100,
    title: '至高',
    benefits: [
      '分身完全理解你',
      '主动提供帮助',
      '超越语言的默契'
    ],
    tasks: [
      `达到${level * 100}经验值`,
      '持续使用培养默契'
    ],
    color: `hsl(${(level - 11) * 30}, 80%, 60%)`
  }
})

const ALL_LEVELS = [...LEVEL_DATA, ...ADVANCED_LEVELS]

interface LevelDetailDialogProps {
  open: boolean
  onClose: () => void
  currentLevel: number
  currentExp: number
}

export function LevelDetailDialog({ open, onClose, currentLevel, currentExp }: LevelDetailDialogProps) {
  const [activeTab, setActiveTab] = React.useState<'level' | 'tasks'>('level')

  const TaskIcon = ({ task }: { task: string }) => {
    if (task.includes('对话')) return <MessageCircle size={14} color="#8b5cf6" />
    if (task.includes('任务') || task.includes('订单')) return <TrendingUp size={14} color="#3b82f6" />
    if (task.includes('分身') || task.includes('托管')) return <Users size={14} color="#22c55e" />
    if (task.includes('学习') || task.includes('深度')) return <Brain size={14} color="#ec4899" />
    if (task.includes('分享') || task.includes('经历')) return <Heart size={14} color="#ef4444" />
    return <Zap size={14} color="#f97316" />
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="level-dialog-content">
        {/* 头部 */}
        <View className="level-dialog-header">
          <View className="level-dialog-title-row">
            <View className="level-dialog-icon">
              <Star size={24} color="#eab308" />
            </View>
            <Text className="level-dialog-title">等级详情</Text>
          </View>
          <View 
            className="level-dialog-close"
            onClick={onClose}
          >
            <X size={20} color="#666" />
          </View>
        </View>

        {/* 当前状态 */}
        <View className="level-current-status">
          <View className="level-current-badge" style={{ backgroundColor: ALL_LEVELS[currentLevel - 1]?.color || '#8b5cf6' }}>
            <Star size={16} color="#fff" />
            <Text className="level-current-text">Lv.{currentLevel}</Text>
          </View>
          <View className="level-current-info">
            <Text className="level-current-title">{ALL_LEVELS[currentLevel - 1]?.title || '未知'}</Text>
            <Text className="level-current-exp">{currentExp} / {currentLevel * 100} XP</Text>
          </View>
          <View className="level-current-progress">
            <View 
              className="level-current-progress-fill" 
              style={{ 
                width: `${Math.min(100, ((currentExp - (currentLevel - 1) * 100) / 100) * 100)}%`,
                backgroundColor: ALL_LEVELS[currentLevel - 1]?.color || '#8b5cf6'
              }} 
            />
          </View>
        </View>

        {/* Tab切换 */}
        <View className="level-tab-bar">
          <View 
            className={cn('level-tab', activeTab === 'level' && 'level-tab-active')}
            onClick={() => setActiveTab('level')}
          >
            <Text className={cn('level-tab-text', activeTab === 'level' && 'level-tab-text-active')}>等级权益</Text>
          </View>
          <View 
            className={cn('level-tab', activeTab === 'tasks' && 'level-tab-active')}
            onClick={() => setActiveTab('tasks')}
          >
            <Text className={cn('level-tab-text', activeTab === 'tasks' && 'level-tab-text-active')}>升级任务</Text>
          </View>
        </View>

        {/* 内容区 */}
        <ScrollView className="level-dialog-scroll" scrollY>
          {activeTab === 'level' ? (
            <View className="level-list">
              {ALL_LEVELS.slice(0, 10).map((level) => (
                <View 
                  key={level.level}
                  className={cn('level-item', level.level === currentLevel && 'level-item-current')}
                >
                  <View className="level-item-header">
                    <View className="level-item-badge" style={{ backgroundColor: level.color }}>
                      <Text className="level-item-badge-text">Lv.{level.level}</Text>
                    </View>
                    <View className="level-item-info">
                      <Text className="level-item-title">{level.title}</Text>
                      <Text className="level-item-exp">{level.minExp} - {level.maxExp} XP</Text>
                    </View>
                    {level.level < currentLevel && (
                      <View className="level-item-completed">
                        <Text className="level-item-completed-text">已达成</Text>
                      </View>
                    )}
                  </View>
                  <View className="level-item-benefits">
                    {level.benefits.map((benefit, idx) => (
                      <View key={idx} className="level-benefit-item">
                        <Star size={12} color={level.color} />
                        <Text className="level-benefit-text">{benefit}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
              {currentLevel > 10 && (
                <View className="level-advanced-hint">
                  <Text className="level-advanced-text">Lv.11-20 持续解锁更高级能力</Text>
                </View>
              )}
            </View>
          ) : (
            <View className="tasks-list">
              {ALL_LEVELS.slice(0, 10).map((level) => (
                <View 
                  key={level.level}
                  className={cn('task-item', level.level === currentLevel && 'task-item-current')}
                >
                  <View className="task-item-header">
                    <View className="task-item-badge" style={{ backgroundColor: level.color }}>
                      <Text className="task-item-badge-text">Lv.{level.level}</Text>
                    </View>
                    <Text className="task-item-title">{level.title}</Text>
                  </View>
                  <View className="task-item-list">
                    {level.tasks.map((task, idx) => (
                      <View key={idx} className="task-item-content">
                        <TaskIcon task={task} />
                        <Text className="task-item-text">{task}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </DialogContent>
    </Dialog>
  )
}
