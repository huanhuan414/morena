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
  Trash2,
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


  // 获取用户ID
  const getUserId = useCallback(() => {
    const userInfo = Taro.getStorageSync('userInfo')
    return userInfo?.id || 1 // 默认1用于测试
  }, [])

  // 加载我的分身列表
  const loadMyClones = useCallback(async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/avatar',
        method: 'GET'
      })
      console.log('加载分身列表:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const avatars = res.data.data.map((item: any) => ({
          id: item.id,
          name: item.name,
          role: item.description || '通用助手',
          status: item.isOnline ? '在线' as const : '离线' as const,
          task: '待命中',
          income: `¥${item.totalEarnings || '0.00'}`,
          image: item.avatar_url || item.photo || 'https://modao.cc/agent-py/media/generated_images/2026-05-09/de8603ebec534b02a82711c7f9a10744.jpg',
          hosting: item.hostingEnabled === 1,
          type: 'my',
          posts: item.totalPosts || 0,
          voice_id: item.voice_id,
          personality: item.personality,
          skills: item.skills,
          created_at: item.created_at
        }))
        setMyClones(avatars)
        
        // 初始化托管开关状态
        const toggles: Record<number, boolean> = {}
        avatars.forEach((avatar: Avatar) => {
          toggles[avatar.id] = avatar.hosting
        })
        setHostingToggles(toggles)
      }
    } catch (error) {
      console.error('加载分身失败:', error)
      // 使用示例数据
      setMyClones([])
    } finally {
      setLoading(false)
    }
  }, [getUserId])

  // 加载分身广场
  const loadSquareClones = useCallback(async () => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: '/api/avatar/list',
        method: 'GET'
      })
      console.log('加载分身广场:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const avatars = res.data.data.slice(0, 6).map((item: any) => ({
          id: item.id,
          name: item.name,
          role: item.personality || '通用助手',
          gender: '未知',
          age: '未知',
          tags: item.personality ? [item.personality] : ['AI助手'],
          posts: item.posts || 0,
          followers: item.followers || 0,
          image: item.avatar_url || 'https://modao.cc/agent-py/media/generated_images/2026-05-09/de8603ebec534b02a82711c7f9a10744.jpg',
          type: 'square' as const,
          isFollowing: false,
          status: '在线' as const,
          task: '待命中',
          hosting: false
        }))
        setSquareClones(avatars)
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
    try {
      await Network.request({
        url: `/api/avatar/${id}/trust`,
        method: 'PUT',
        data: { trust_enabled: checked }
      })
      console.log('更新托管状态成功:', id, checked)
    } catch (error) {
      console.error('更新托管状态失败:', error)
      Taro.showToast({ title: '更新失败', icon: 'none' })
    }
  }

  // 删除分身
  const handleDeleteClone = (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个分身吗？此操作不可恢复。',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            await Network.request({
              url: `/api/avatar/${id}`,
              method: 'DELETE'
            })
            console.log('删除分身成功:', id)
            Taro.showToast({ title: '删除成功', icon: 'success' })
            loadMyClones()
          } catch (error) {
            console.error('删除分身失败:', error)
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      }
    })
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
              {activeTab === 'my' ? '还没有分身' : '暂无内容'}
            </Text>
            <Text className="empty-desc">
              {activeTab === 'my' ? '创建你的第一个AI分身\n开启智能社交新体验' : '稍后再来看看吧'}
            </Text>
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
                    <View className="toolbar-btn delete-btn" onClick={() => handleDeleteClone(clone.id)}>
                      <Trash2 size={15} color="#EF4444" />
                      <Text className="toolbar-label delete-label">删除</Text>
                    </View>
                  </View>
                  <View className="hosting-control">
                    <Zap size={12} className="hosting-icon" />
                    <Text className="hosting-label">自动托管</Text>
                    <Switch
                      checked={clone.trust || false}
                      color="#7B3FE4"
                      onChange={(checked) => handleToggleHosting(clone.id, checked)}
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
                    <View className="toolbar-btn delete-btn" onClick={() => handleDeleteClone(clone.id)}>
                      <Trash2 size={15} color="#EF4444" />
                      <Text className="toolbar-label delete-label">删除</Text>
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
