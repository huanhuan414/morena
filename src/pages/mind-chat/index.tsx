// @ts-nocheck
import React, { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import {
  Search,
  Plus,
  Image as ImageIcon,
  FileText,
  Clock,
  Sparkles,
  Zap
} from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import './index.css'

type CloneType = 'my' | 'square'

interface MyClone {
  id: number
  name: string
  role: string
  status: '在线' | '忙碌' | '离线'
  task: string
  income: string
  image: string
  hosting: boolean
  type: 'my'
  posts: number
  followers?: number
}

interface SquareClone {
  id: number
  name: string
  role: string
  gender: string
  age: string
  tags: string[]
  posts: number
  followers: number
  image: string
  type: 'square'
  isFollowing: boolean
  status: '在线' | '忙碌' | '离线'
  task: string
  hosting: boolean
}

const MindChat: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CloneType>('my')
  const [searchValue, setSearchValue] = useState('')

  const myClones: MyClone[] = [
    {
      id: 1,
      name: '数字合伙人 - 晓晨',
      role: '知识博主',
      status: '在线',
      task: '正在录制《AI趋势》视频',
      income: '¥128.00',
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/de8603ebec534b02a82711c7f9a10744.jpg',
      hosting: true,
      type: 'my',
      posts: 45
    },
    {
      id: 2,
      name: '虚拟导师 - 莉莎',
      role: '职场专家',
      status: '忙碌',
      task: '处理粉丝提问中 (32条)',
      income: '¥450.50',
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/3a6b5955abb240f5a99ac6366bd561ad.jpg',
      hosting: true,
      type: 'my',
      posts: 128
    },
    {
      id: 3,
      name: '带货达人 - 阿飞',
      role: '美妆主播',
      status: '离线',
      task: '暂无任务',
      income: '¥0.00',
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/3ec3faccca184f0496feabf22fbfea5b.jpg',
      hosting: false,
      type: 'my',
      posts: 0
    }
  ]

  const squareClones: SquareClone[] = [
    {
      id: 4,
      name: '知识导师 - 林浩',
      role: '知识博主',
      gender: '男',
      age: '28岁',
      tags: ['理性', '专业', '深度'],
      posts: 256,
      followers: 12500,
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/de8603ebec534b02a82711c7f9a10744.jpg',
      type: 'square',
      isFollowing: false,
      status: '在线',
      task: '正在解答粉丝问题',
      hosting: false
    },
    {
      id: 5,
      name: '生活达人 - 苏晴',
      role: '生活博主',
      gender: '女',
      age: '25岁',
      tags: ['温柔', '知性', '生活'],
      posts: 189,
      followers: 8900,
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/3a6b5955abb240f5a99ac6366bd561ad.jpg',
      type: 'square',
      isFollowing: true,
      status: '忙碌',
      task: '录制生活vlog中',
      hosting: true
    },
    {
      id: 6,
      name: '职场精英 - 张伟',
      role: '职场达人',
      gender: '男',
      age: '32岁',
      tags: ['职场', '管理', '晋升'],
      posts: 342,
      followers: 15600,
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/3ec3faccca184f0496feabf22fbfea5b.jpg',
      type: 'square',
      isFollowing: false,
      status: '离线',
      task: '暂无任务',
      hosting: false
    }
  ]

  const filteredClones = (activeTab === 'my' ? myClones : squareClones).filter(clone =>
    clone.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleToggleHosting = (id: number) => {
    console.log('Toggle hosting:', id)
  }

  const formatFollowers = (num: number) => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w'
    }
    return num.toString()
  }

  return (
    <View className="mind-chat-page">
      {/* 顶部渐变背景 - 一体化设计 */}
      <View className="page-header">
        {/* 装饰元素 */}
        <View className="header-decoration">
          <View className="decoration-circle circle-1" />
          <View className="decoration-circle circle-2" />
        </View>
        
        {/* Tab切换 - 无图标 */}
        <View className="header-tabs">
          <View
            className={cn('header-tab', activeTab === 'my' && 'active')}
            onClick={() => setActiveTab('my')}
          >
            <Text className="tab-label">我的分身</Text>
            {activeTab === 'my' && <View className="tab-indicator" />}
          </View>
          <View
            className={cn('header-tab', activeTab === 'square' && 'active')}
            onClick={() => setActiveTab('square')}
          >
            <Text className="tab-label">分身广场</Text>
            {activeTab === 'square' && <View className="tab-indicator" />}
          </View>
        </View>

        {/* 搜索和操作栏 */}
        <View className="search-section">
          <View className="search-wrapper">
            <View className="search-icon-wrapper">
              <Search size={16} />
            </View>
            <Input
              className="search-input"
              placeholder="搜索分身..."
              value={searchValue}
              onInput={(e: any) => setSearchValue(e.detail.value)}
            />
          </View>
          {activeTab === 'my' && (
            <View 
              className="add-button"
              onClick={() => Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })}
            >
              <Plus size={18} color="#ffffff" />
              <Text className="add-button-text">新建</Text>
            </View>
          )}
        </View>
      </View>

      {/* 内容区域 */}
      <ScrollView
        className="content-scroll"
        scrollY
      >
        {activeTab === 'my' ? (
          <View className="my-clones-list">
            {(filteredClones as MyClone[]).map((clone, index) => (
              <View key={clone.id} className="clone-card" style={{ animationDelay: `${index * 0.1}s` }}>
                {/* 封面 */}
                <View className="clone-cover">
                  <Image className="cover-image" src={clone.image} mode="aspectFill" />
                  <View className="cover-gradient" />
                  
                  {/* 状态标签 */}
                  <View className={cn('status-badge', clone.status)}>
                    <View className={cn('status-dot', clone.status)} />
                    <Text className="status-label">{clone.status}</Text>
                  </View>

                  {/* 任务指示 */}
                  <View className="task-indicator">
                    <Clock size={11} />
                    <Text className="task-label">{clone.task}</Text>
                  </View>

                  {/* AI标识 */}
                  <View className="ai-badge">
                    <Sparkles size={10} />
                    <Text className="ai-label">AI</Text>
                  </View>

                  {/* 底部信息 */}
                  <View className="cover-footer">
                    <View className="clone-profile">
                      <Image className="profile-avatar" src={clone.image} />
                      <View className="profile-info">
                        <Text className="profile-name">{clone.name}</Text>
                        <View className="profile-tags">
                          <Badge variant="outline" className="role-tag">{clone.role}</Badge>
                        </View>
                      </View>
                    </View>
                    <View className="income-display">
                      <Text className="income-label">今日收益</Text>
                      <Text className="income-amount">{clone.income}</Text>
                    </View>
                  </View>
                </View>

                {/* 操作栏 */}
                <View className="clone-toolbar">
                  <View className="toolbar-actions">
                    <View className="toolbar-btn">
                      <ImageIcon size={15} />
                      <Text className="toolbar-label">形象</Text>
                    </View>
                    <View className="toolbar-btn">
                      <FileText size={15} />
                      <Text className="toolbar-label">内容</Text>
                    </View>
                  </View>
                  <View className="hosting-control">
                    <Zap size={12} className="hosting-icon" />
                    <Text className="hosting-label">自动托管</Text>
                    <Switch
                      checked={clone.hosting}
                      color="#7B3FE4"
                      onChange={() => handleToggleHosting(clone.id)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="my-clones-list">
            {(filteredClones as SquareClone[]).map((clone, index) => (
              <View key={clone.id} className="clone-card" style={{ animationDelay: `${index * 0.1}s` }}>
                {/* 封面 */}
                <View className="clone-cover">
                  <Image className="cover-image" src={clone.image} mode="aspectFill" />
                  <View className="cover-gradient" />
                  
                  {/* 状态标签 */}
                  <View className={cn('status-badge', clone.status)}>
                    <View className={cn('status-dot', clone.status)} />
                    <Text className="status-label">{clone.status}</Text>
                  </View>

                  {/* 任务指示 */}
                  <View className="task-indicator">
                    <Clock size={11} />
                    <Text className="task-label">{clone.task}</Text>
                  </View>

                  {/* AI标识 */}
                  <View className="ai-badge">
                    <Sparkles size={10} />
                    <Text className="ai-label">AI</Text>
                  </View>

                  {/* 底部信息 */}
                  <View className="cover-footer">
                    <View className="clone-profile">
                      <Image className="profile-avatar" src={clone.image} />
                      <View className="profile-info">
                        <Text className="profile-name">{clone.name}</Text>
                        <View className="profile-tags">
                          <Badge variant="outline" className="role-tag">{clone.role}</Badge>
                        </View>
                      </View>
                    </View>
                    <View className="income-display">
                      <Text className="income-label">{formatFollowers(clone.followers)}</Text>
                      <Text className="income-amount">粉丝</Text>
                    </View>
                  </View>
                </View>

                {/* 操作栏 */}
                <View className="clone-toolbar">
                  <View className="toolbar-actions">
                    <View className="toolbar-btn">
                      <ImageIcon size={15} />
                      <Text className="toolbar-label">形象</Text>
                    </View>
                    <View className="toolbar-btn">
                      <FileText size={15} />
                      <Text className="toolbar-label">内容</Text>
                    </View>
                  </View>
                  <View className={cn('follow-action-btn', clone.isFollowing && 'following')}>
                    <Text className="follow-action-text">{clone.isFollowing ? '已关注' : '+ 关注'}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
        
        <View className="bottom-spacer" />
      </ScrollView>
    </View>
  )
}

export default MindChat
