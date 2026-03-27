import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useDidShow, navigateTo, switchTab } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
import { 
  Sparkles, Plus, Bot, Send, Image as ImageIcon, Video, FileText, 
  Search, Zap, ChevronRight, Clock, Loader,
  Brain, PenTool, ChartBarBig, Globe
} from 'lucide-react-taro'
import './index.css'

interface Avatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  abilities?: string[]
  exp?: number
}

interface Task {
  id: string
  title: string
  status: 'pending' | 'executing' | 'completed'
  progress: number
  task_type: string
  created_at: string
}

export default function HomePage() {
  const { userInfo, isLoggedIn } = useUserStore()
  const [avatars, setAvatars] = useState<Avatar[]>([])
  const [activeAvatar, setActiveAvatar] = useState<Avatar | null>(null)
  const [runningTasks, setRunningTasks] = useState<Task[]>([])
  const [quickCommand, setQuickCommand] = useState('')
  const [commandLoading, setCommandLoading] = useState(false)

  useLoad(() => {
    if (!isLoggedIn) {
      navigateTo({ url: '/pages/login/index' })
    }
  })

  useDidShow(() => {
    if (isLoggedIn) {
      fetchAvatars()
      fetchRunningTasks()
    }
  })

  // 获取分身列表
  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: '/api/avatar' })
      if (res.data?.code === 200) {
        const list = res.data.data || []
        setAvatars(list)
        if (list.length > 0 && !activeAvatar) {
          setActiveAvatar(list[0])
        }
      }
    } catch (error) {
      console.error('获取分身失败:', error)
    }
  }

  // 获取正在执行的任务
  const fetchRunningTasks = async () => {
    try {
      const res = await Network.request({ 
        url: '/api/task',
        data: { status: 'executing' }
      })
      if (res.data?.code === 200) {
        setRunningTasks(res.data.data || [])
      }
    } catch (error) {
      console.error('获取任务失败:', error)
    }
  }

  // 快速指令执行
  const executeQuickCommand = async () => {
    if (!quickCommand.trim() || commandLoading) return

    setCommandLoading(true)

    try {
      // 先创建或获取对话
      const avatarId = activeAvatar?.id
      if (!avatarId) {
        navigateTo({ url: '/pages/avatar-create/index' })
        return
      }

      // 跳转到对话页并传递指令
      navigateTo({ 
        url: `/pages/chat/index?avatarId=${avatarId}&command=${encodeURIComponent(quickCommand)}`
      })
      setQuickCommand('')
    } catch (error) {
      console.error('执行指令失败:', error)
    } finally {
      setCommandLoading(false)
    }
  }

  // 分身能力列表
  const abilities = [
    { icon: Search, name: '智能搜索', desc: '搜索互联网信息', color: '#00f5ff' },
    { icon: ImageIcon, name: '图片生成', desc: 'AI创作图片', color: '#bf00ff' },
    { icon: Video, name: '视频生成', desc: 'AI生成视频', color: '#ff00aa' },
    { icon: FileText, name: '文档创作', desc: '撰写报告文章', color: '#00ff88' },
    { icon: Brain, name: '数据分析', desc: '深度分析问题', color: '#ffaa00' },
    { icon: Globe, name: '多语言翻译', desc: '跨语言沟通', color: '#00aaff' },
  ]

  // 快捷任务
  const quickTasks = [
    { icon: Search, text: '搜索最新AI动态', command: '帮我搜索最新的AI新闻动态' },
    { icon: ImageIcon, text: '生成一张海报', command: '帮我生成一张创意海报' },
    { icon: FileText, text: '写一篇报告', command: '帮我写一份工作总结报告' },
    { icon: PenTool, text: '帮我做PPT大纲', command: '帮我做一个PPT大纲' },
  ]

  const handleCreateAvatar = () => {
    navigateTo({ url: '/pages/avatar-create/index' })
  }

  const handleSelectAvatar = (avatar: Avatar) => {
    setActiveAvatar(avatar)
  }

  const handleStartChat = () => {
    if (activeAvatar) {
      switchTab({ url: '/pages/chat/index' })
    } else {
      handleCreateAvatar()
    }
  }

  const handleQuickTask = (command: string) => {
    setQuickCommand(command)
  }

  if (!isLoggedIn) return null

  return (
    <View className="home-page">
      {/* 背景装饰 */}
      <View className="bg-glow" />
      <View className="grid-overlay" />

      {/* 顶部区域 */}
      <View className="header-section">
        <View className="header-top">
          <View className="user-info">
            <View className="avatar-wrap">
              {userInfo?.avatar ? (
                <Image src={userInfo.avatar} className="user-avatar" mode="aspectFill" />
              ) : (
                <View className="avatar-placeholder">
                  <Text className="avatar-text">{userInfo?.nickname?.[0] || 'U'}</Text>
                </View>
              )}
            </View>
            <View className="greeting">
              <Text className="greeting-text">Hi, {userInfo?.nickname || '探索者'}</Text>
              <Text className="greeting-sub">让AI分身为你工作</Text>
            </View>
          </View>
        </View>

        {/* 快速指令输入 */}
        <View className="command-section">
          <View className="command-wrap">
            <View className="command-icon">
              <Zap size={20} color="#00f5ff" />
            </View>
            <Input
              className="command-input"
              placeholder="说一句话，让分身去做事..."
              value={quickCommand}
              onInput={e => setQuickCommand(e.detail.value)}
              onConfirm={executeQuickCommand}
              confirmType="send"
            />
            <Button 
              className={`command-btn ${quickCommand.trim() ? 'active' : ''}`}
              onClick={executeQuickCommand}
              disabled={!quickCommand.trim() || commandLoading}
            >
              {commandLoading ? (
                <Loader size={20} className="animate-spin" color="#0a0a0f" />
              ) : (
                <Send size={20} color={quickCommand.trim() ? '#0a0a0f' : 'rgba(255,255,255,0.3)'} />
              )}
            </Button>
          </View>

          {/* 快捷任务标签 */}
          <ScrollView className="quick-tasks-scroll" scrollX>
            {quickTasks.map((task, idx) => {
              const Icon = task.icon
              return (
                <View 
                  key={idx} 
                  className="quick-task-tag"
                  onClick={() => handleQuickTask(task.command)}
                >
                  <Icon size={14} color="#00f5ff" />
                  <Text className="quick-task-text">{task.text}</Text>
                </View>
              )
            })}
          </ScrollView>
        </View>
      </View>

      <ScrollView className="main-scroll" scrollY>
        {/* AI分身区域 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-wrap">
              <Sparkles size={20} color="#00f5ff" />
              <Text className="section-title">我的AI分身</Text>
            </View>
            <View className="section-action" onClick={handleCreateAvatar}>
              <Plus size={18} color="#00f5ff" />
            </View>
          </View>

          {avatars.length === 0 ? (
            <View className="create-avatar-card" onClick={handleCreateAvatar}>
              <View className="create-avatar-icon">
                <Bot size={48} color="#00f5ff" />
              </View>
              <View className="create-avatar-info">
                <Text className="create-avatar-title">创建你的AI分身</Text>
                <Text className="create-avatar-desc">一个能帮你自动完成任务的智能助手</Text>
              </View>
              <ChevronRight size={24} color="rgba(255,255,255,0.3)" />
            </View>
          ) : (
            <View className="avatar-main-card">
              <View className="avatar-display" onClick={handleStartChat}>
                <View className="avatar-avatar-large">
                  {activeAvatar?.avatar_url ? (
                    <Image src={activeAvatar.avatar_url} className="avatar-img-large" mode="aspectFill" />
                  ) : (
                    <Sparkles size={48} color="#00f5ff" />
                  )}
                </View>
                <View className="avatar-info">
                  <Text className="avatar-name-large">{activeAvatar?.name || 'AI分身'}</Text>
                  <View className="avatar-level-badge">
                    <Text className="level-badge-text">Lv.{activeAvatar?.level || 1}</Text>
                  </View>
                </View>
                <View className="chat-enter-btn">
                  <Text className="chat-enter-text">开始对话</Text>
                  <ChevronRight size={18} color="#0a0a0f" />
                </View>
              </View>

              {/* 分身切换 */}
              {avatars.length > 1 && (
                <ScrollView className="avatars-switch" scrollX>
                  {avatars.map(avatar => (
                    <View 
                      key={avatar.id}
                      className={`avatar-switch-item ${activeAvatar?.id === avatar.id ? 'active' : ''}`}
                      onClick={() => handleSelectAvatar(avatar)}
                    >
                      <View className="switch-avatar">
                        {avatar.avatar_url ? (
                          <Image src={avatar.avatar_url} className="switch-avatar-img" mode="aspectFill" />
                        ) : (
                          <Sparkles size={20} color="#00f5ff" />
                        )}
                      </View>
                      <Text className="switch-name">{avatar.name}</Text>
                    </View>
                  ))}
                  <View className="avatar-switch-item add" onClick={handleCreateAvatar}>
                    <View className="switch-avatar add-avatar">
                      <Plus size={20} color="rgba(255,255,255,0.5)" />
                    </View>
                    <Text className="switch-name">创建</Text>
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>

        {/* 正在执行的任务 */}
        {runningTasks.length > 0 && (
          <View className="section">
            <View className="section-header">
              <View className="section-title-wrap">
                <Clock size={18} color="#ffaa00" />
                <Text className="section-title">正在执行</Text>
              </View>
            </View>
            <View className="running-tasks">
              {runningTasks.slice(0, 3).map(task => (
                <View key={task.id} className="running-task-item">
                  <View className="task-status-icon">
                    <Loader size={16} className="animate-spin" color="#00f5ff" />
                  </View>
                  <View className="task-info">
                    <Text className="task-title">{task.title}</Text>
                    <View className="task-progress-bar">
                      <View className="task-progress-fill" style={{ width: `${task.progress}%` }} />
                    </View>
                  </View>
                  <Text className="task-progress-text">{task.progress}%</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 分身能力 */}
        <View className="section">
          <View className="section-header">
            <View className="section-title-wrap">
              <Zap size={18} color="#bf00ff" />
              <Text className="section-title">分身能力</Text>
            </View>
          </View>
          <View className="abilities-grid">
            {abilities.map((ability, idx) => {
              const Icon = ability.icon
              return (
                <View 
                  key={idx} 
                  className="ability-card"
                  onClick={() => {
                    setQuickCommand(ability.desc)
                  }}
                >
                  <View 
                    className="ability-icon"
                    style={{ 
                      background: `${ability.color}15`,
                      boxShadow: `0 0 20px ${ability.color}20`
                    }}
                  >
                    <Icon size={24} color={ability.color} />
                  </View>
                  <Text className="ability-name">{ability.name}</Text>
                  <Text className="ability-desc">{ability.desc}</Text>
                </View>
              )
            })}
          </View>
        </View>

        {/* 功能导航 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">更多功能</Text>
          </View>
          <View className="nav-cards">
            <View className="nav-card" onClick={() => switchTab({ url: '/pages/task/index' })}>
              <View className="nav-card-icon">
                <ChartBarBig size={24} color="#00f5ff" />
              </View>
              <View className="nav-card-info">
                <Text className="nav-card-title">任务管理</Text>
                <Text className="nav-card-desc">查看所有任务记录</Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.2)" />
            </View>
            <View className="nav-card" onClick={() => switchTab({ url: '/pages/social/index' })}>
              <View className="nav-card-icon">
                <Sparkles size={24} color="#bf00ff" />
              </View>
              <View className="nav-card-info">
                <Text className="nav-card-title">创意广场</Text>
                <Text className="nav-card-desc">发现精彩内容</Text>
              </View>
              <ChevronRight size={20} color="rgba(255,255,255,0.2)" />
            </View>
          </View>
        </View>

        {/* 底部留白 */}
        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
