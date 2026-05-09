// @ts-nocheck
import React, { useState } from 'react'
import Taro from '@tarojs/taro';
import { View, Text, Image, ScrollView } from '@tarojs/components'
import {
  Search,
  Plus,
  Image as ImageIcon,
  Cpu,
  FileText,
  EllipsisVertical,
  Users,
  Clock,
  TrendingUp,
  User
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
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/avatar1.jpg',
      type: 'square',
      isFollowing: false
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
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/avatar2.jpg',
      type: 'square',
      isFollowing: true
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
      image: 'https://modao.cc/agent-py/media/generated_images/2026-05-09/avatar3.jpg',
      type: 'square',
      isFollowing: false
    }
  ]

  const filteredClones = (activeTab === 'my' ? myClones : squareClones).filter(clone =>
    clone.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  const handleToggleHosting = (id: number) => {
    console.log('Toggle hosting:', id)
  }

  return (
    <View className="mind-chat-page">
      {/* 顶部Tab */}
      <View className="page-tabs">
        <View
          className={cn('tab-item', activeTab === 'my' && 'active')}
          onClick={() => setActiveTab('my')}
        >
          <User size={18} />
          <Text className="tab-text">我的分身</Text>
        </View>
        <View
          className={cn('tab-item', activeTab === 'square' && 'active')}
          onClick={() => setActiveTab('square')}
        >
          <Users size={18} />
          <Text className="tab-text">分身广场</Text>
        </View>
        <View className={cn('tab-indicator', activeTab === 'square' && 'right')} />
      </View>

      {/* 搜索和操作栏 */}
      <View className="search-bar">
        <View className="search-input-wrapper">
          <Search size={18} className="search-icon" />
          <Input
            className="search-input"
            placeholder="搜索分身..."
            value={searchValue}
            onInput={(e: any) => setSearchValue(e.detail.value)}
          />
        </View>
        {activeTab === 'my' && (
          <View className="add-btn" onClick={() => Taro.navigateTo({ url: '/pages/avatar/avatar-create/index' })}>
            <Plus size={20} />
            <Text className="add-btn-text">新增分身</Text>
          </View>
        )}
      </View>

      {/* 内容区域 */}
      <ScrollView
        className="content-scroll"
        scrollY
      >
        {activeTab === 'my' ? (
          <View className="my-clones-list">
            {(filteredClones as MyClone[]).map((clone) => (
              <View key={clone.id} className="clone-card">
                {/* 封面 */}
                <View className="clone-cover">
                  <Image className="cover-image" src={clone.image} mode="aspectFill" />
                  <View className="cover-overlay" />
                  
                  {/* 状态标签 */}
                  <View className={cn('status-badge', clone.status)}>
                    <View className={cn('status-dot', clone.status)} />
                    <Text className="status-text">{clone.status}</Text>
                  </View>

                  {/* 任务指示 */}
                  <View className="task-badge">
                    <Clock size={12} />
                    <Text className="task-text">{clone.task}</Text>
                  </View>

                  {/* 底部信息 */}
                  <View className="cover-bottom">
                    <View className="clone-info">
                      <Image className="clone-avatar" src={clone.image} />
                      <View className="clone-text">
                        <Text className="clone-name">{clone.name}</Text>
                        <Badge variant="outline" className="role-badge">{clone.role}</Badge>
                      </View>
                    </View>
                    <View className="income-info">
                      <Text className="income-label">今日收益</Text>
                      <Text className="income-value">{clone.income}</Text>
                    </View>
                  </View>
                </View>

                {/* 操作栏 */}
                <View className="clone-actions">
                  <View className="action-buttons">
                    <View className="action-btn">
                      <ImageIcon size={16} />
                      <Text className="action-text">形象</Text>
                    </View>
                    <View className="action-btn">
                      <Cpu size={16} />
                      <Text className="action-text">托管</Text>
                    </View>
                    <View className="action-btn">
                      <FileText size={16} />
                      <Text className="action-text">内容</Text>
                    </View>
                    <View className="action-btn">
                      <EllipsisVertical size={16} />
                      <Text className="action-text">更多</Text>
                    </View>
                  </View>
                  <View className="hosting-toggle">
                    <Text className="toggle-label">自动托管</Text>
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
          <View className="square-clones-list">
            {(filteredClones as SquareClone[]).map((clone) => (
              <View key={clone.id} className="square-card">
                <View className="square-left">
                  <Image className="square-avatar" src={clone.image} />
                  <View className="online-indicator" />
                </View>
                <View className="square-content">
                  <View className="square-header">
                    <Text className="square-name">{clone.name}</Text>
                    <Badge variant="outline" className="role-badge">{clone.role}</Badge>
                  </View>
                  <View className="square-tags">
                    {clone.tags.map((tag, idx) => (
                      <View key={idx} className="tag-item">
                        <Text className="tag-text">{tag}</Text>
                      </View>
                    ))}
                  </View>
                  <View className="square-stats">
                    <View className="stat-item">
                      <TrendingUp size={12} />
                      <Text className="stat-text">{clone.posts} 帖子</Text>
                    </View>
                    <View className="stat-item">
                      <Users size={12} />
                      <Text className="stat-text">{clone.followers} 粉丝</Text>
                    </View>
                  </View>
                </View>
                <View className={cn('follow-btn', clone.isFollowing && 'following')}>
                  <Text className="follow-text">{clone.isFollowing ? '已关注' : '+ 关注'}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
        
        <View className="bottom-safe" />
      </ScrollView>
    </View>
  )
}

export default MindChat
