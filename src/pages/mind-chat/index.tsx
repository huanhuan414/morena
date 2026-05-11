// @ts-nocheck
import React, { useState, useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import {
  Search,
  Plus,
  Phone,
  Clock,
  Zap,
  Loader,
  Sparkles
} from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Network } from '@/network'
import './index.css'

type CloneType = 'my' | 'square'

interface Avatar {
  id: string
  name: string
  role: string
  status: '在线' | '忙碌' | '离线'
  task: string
  income: string
  image: string
  hosting: boolean
  type: 'my' | 'square'
  posts: number
  followers?: number
  isFollowing?: boolean
  voice_id?: string
  personality?: string
  skills?: string
  created_at?: string
}

const MindChat: React.FC = () => {
  const [activeTab, setActiveTab] = useState<CloneType>('my')
  const [searchValue, setSearchValue] = useState('')
  const [myClones, setMyClones] = useState<Avatar[]>([])
  const [squareClones, setSquareClones] = useState<Avatar[]>([])
  const [loading, setLoading] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(true)

  // 加载我的分身列表
  const loadMyClones = useCallback(async () => {
    try {
      setLoading(true)
      // 检查用户登录状态
      const storedUserInfo: any = Taro.getStorageSync('userInfo') || {}
      const userId = storedUserInfo.id || ''
      if (!userId || userId === 'guest-user-id') {
        setIsLoggedIn(false)
        setMyClones([])
        setLoading(false)
        return
      }
      setIsLoggedIn(true)

      // Network 模块会自动从 storage 获取 userId 并添加 x-user-id header
      const res = await Network.request({
        url: '/api/avatar',
        method: 'GET',
      })
      console.log('加载分身列表:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const rawData = res.data.data
        const data = Array.isArray(rawData) ? rawData : []
        const avatars = data.map((item: any) => ({
          id: item.id || '',
          name: item.name || '未命名分身',
          role: item.description || item.personality || '通用助手',
          status: (item.isHosted || item.trustEnabled || item.trust_enabled || item.hostingEnabled) ? '在线' as const : '离线' as const,
          task: '待命中',
          income: `¥${item.totalEarnings || item.todayEarnings || '0.00'}`,
          image: item.avatarUrl || item.avatar_url || item.photo || '',
          hosting: Boolean(item.isHosted || item.trustEnabled || item.trust_enabled || item.hostingEnabled),
          type: 'my',
          posts: item.totalPosts || 0,
          voice_id: item.voiceId || item.voice_id,
          personality: item.personality,
          skills: item.skills,
          created_at: item.createdAt || item.created_at
        }))
        console.log('处理后的分身列表:', avatars)
        setMyClones(avatars)
      } else {
        console.log('API返回数据为空')
        setMyClones([])
      }
    } catch (error) {
      console.error('加载分身失败:', error)
      setMyClones([])
    } finally {
      setLoading(false)
    }
  }, [])

  // 加载分身广场
  const loadSquareClones = useCallback(async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/avatar/list',
        method: 'GET'
      })
      console.log('加载分身广场:', res.data)
      
      // 兼容多种返回结构
      if (res.data?.code === 200) {
        const listData = res.data?.data?.data?.list || res.data?.data?.list || []
        const avatars = listData.slice(0, 6).map((item: any) => ({
          id: item.id || '',
          name: item.name || '未命名分身',
          role: item.personality || '通用助手',
          gender: '未知',
          age: '未知',
          tags: item.personality ? [item.personality] : ['AI助手'],
          posts: item.posts || 0,
          followers: item.followers || 0,
          image: item.avatarUrl || item.avatar_url || item.photo || '',
          type: 'square' as const,
          isFollowing: false,
          status: '在线' as const,
          task: '待命中',
          hosting: false
        }))
        console.log('处理后的广场分身列表:', avatars)
        setSquareClones(avatars)
      } else {
        console.log('广场数据为空')
        setSquareClones([])
      }
    } catch (error) {
      console.error('加载分身广场失败:', error)
      setSquareClones([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'my') {
      loadMyClones()
    } else {
      loadSquareClones()
    }
  }, [activeTab, loadMyClones, loadSquareClones])

  const filteredClones = (activeTab === 'my' ? myClones : squareClones).filter(clone =>
    clone.name.toLowerCase().includes(searchValue.toLowerCase())
  )

  // 切换托管状态
  const handleToggleHosting = async (id: string, checked: boolean) => {
    const previous = myClones
    // 乐观更新，避免用户感知“点击无反应”
    setMyClones(prev =>
      prev.map(clone =>
        clone.id === id
          ? { ...clone, hosting: checked, status: checked ? '在线' : '离线' }
          : clone
      )
    )

    try {
      const res = await Network.request({
        url: `/api/avatar/${id}/trust`,
        method: 'PUT',
        data: { trust_enabled: checked },
      })
      if (res.data?.code !== 200) {
        throw new Error(res.data?.msg || '更新失败')
      }
      console.log('更新托管状态成功:', id, checked)
    } catch (error) {
      setMyClones(previous)
      console.error('更新托管状态失败:', error)
      Taro.showToast({ title: '更新失败', icon: 'none' })
    }
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
        {loading ? (
          <View className="loading-state">
            <Loader size={32} className="animate-spin" />
            <Text className="loading-text">加载中...</Text>
          </View>
        ) : filteredClones.length === 0 ? (
          <View className="empty-state">
            <View className="empty-icon-wrap">
              <Sparkles size={56} color="rgba(6, 182, 212, 0.6)" />
            </View>
            <Text className="empty-title">
              {searchValue
                ? '没有匹配结果'
                : activeTab === 'my'
                  ? (isLoggedIn ? '还没有分身' : '请先登录')
                  : '暂无内容'}
            </Text>
            <Text className="empty-desc">
              {searchValue
                ? '换个关键词试试'
                : activeTab === 'my'
                  ? (isLoggedIn
                    ? '创建你的第一个AI分身\n开启智能社交新体验'
                    : '登录后可管理你的分身与托管能力')
                  : '稍后再来看看吧'}
            </Text>
            {!isLoggedIn && activeTab === 'my' && !searchValue && (
              <View
                className="login-redirect-btn"
                onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
              >
                <Text className="login-redirect-text">去登录</Text>
              </View>
            )}
          </View>
        ) : activeTab === 'my' ? (
          <View className="my-clones-list">
            {(filteredClones as Avatar[]).map((clone, index) => (
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
                    <View className="toolbar-btn" onClick={() => Taro.showToast({ title: '通话功能开发中', icon: 'none' })}>
                      <Phone size={15} />
                      <Text className="toolbar-label">通话</Text>
                    </View>
                  </View>
                  <View className="hosting-control">
                    <Zap size={12} className="hosting-icon" />
                    <Text className="hosting-label">自动托管</Text>
                    <Switch
                      checked={clone.hosting || false}
                      onCheckedChange={(checked) => handleToggleHosting(clone.id, checked)}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="my-clones-list">
            {(filteredClones as Avatar[]).map((clone, index) => (
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
                      <Text className="income-label">{formatFollowers(clone.followers || 0)}</Text>
                      <Text className="income-amount">粉丝</Text>
                    </View>
                  </View>
                </View>

                {/* 操作栏 */}
                <View className="clone-toolbar">
                  <View className="toolbar-actions">
                    <View className="toolbar-btn" onClick={() => Taro.showToast({ title: '通话功能开发中', icon: 'none' })}>
                      <Phone size={15} />
                      <Text className="toolbar-label">通话</Text>
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
