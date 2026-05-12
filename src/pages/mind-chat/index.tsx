// @ts-nocheck
import React, { useState, useEffect, useCallback, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import {
  Search,
  Plus,
  Phone,
  Clock,
  Zap,
  Loader,
  Sparkles,
  Users,
  Trash2
} from 'lucide-react-taro'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { Network } from '@/network'
import { useUserStore } from '@/stores/user'
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
  const { isLoggedIn: isLoggedIn } = useUserStore()
  const hasPageShownRef = useRef(false)
  const activeTabRef = useRef<CloneType>('my')

  // 加载我的分身列表
  const loadMyClones = useCallback(async () => {
    try {
      setLoading(true)
      // 使用全局 store 检查登录状态
      if (!isLoggedIn) {
        setMyClones([])
        setLoading(false)
        return
      }

      // Network 模块会自动从 storage 获取 userId 并添加 x-user-id header
      const res = await Network.request({
        url: '/api/avatar',
        method: 'GET',
      })
      console.log('加载分身列表:', res.data)
      
      if (res.data?.code === 200 && res.data?.data) {
        const rawData = res.data.data
        const data = Array.isArray(rawData) ? rawData : []
        const avatars = data.map((item: any) => {
          // 解析 personality JSON 字符串，提取标签
          let roleLabel = '通用助手'
          try {
            const p = typeof item.personality === 'string' ? JSON.parse(item.personality) : item.personality
            if (p?.tags?.length) {
              roleLabel = p.tags.slice(0, 3).join('·')
            }
          } catch {}
          
          return {
            id: item.id || '',
            name: item.name || '未命名分身',
            role: item.description || roleLabel,
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
          }
        })
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
        const avatars = listData.slice(0, 6).map((item: any) => {
          // 解析 personality JSON 字符串
          let tags = ['AI助手']
          let roleLabel = '通用助手'
          try {
            const p = typeof item.personality === 'string' ? JSON.parse(item.personality) : item.personality
            if (p?.tags?.length) {
              tags = p.tags
              roleLabel = p.tags.slice(0, 3).join('·')
            }
          } catch {}
          
          return {
            id: item.id || '',
            name: item.name || '未命名分身',
            role: roleLabel,
            gender: '未知',
            age: '未知',
            tags,
            posts: item.posts || 0,
            followers: item.followers || 0,
            image: item.avatarUrl || item.avatar_url || item.photo || '',
            type: 'square' as const,
            isFollowing: false,
            status: '在线' as const,
            task: '待命中',
            hosting: false
          }
        })
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

  const loadCurrentTabData = useCallback(async () => {
    if (activeTabRef.current === 'my') {
      await loadMyClones()
      return
    }

    await loadSquareClones()
  }, [loadMyClones, loadSquareClones])

  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // 首次挂载就加载数据（H5 端 useDidShow 可能不触发）
  useEffect(() => {
    hasPageShownRef.current = true
    void loadCurrentTabData()
  }, [])

  useDidShow(() => {
    if (hasPageShownRef.current) {
      // 非首次显示时重新加载（从其他页面返回）
      void loadCurrentTabData()
    }
    hasPageShownRef.current = true
  })

  useEffect(() => {
    if (!hasPageShownRef.current) {
      return
    }

    void loadCurrentTabData()
  }, [activeTab, loadCurrentTabData])

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

  const openAvatarFriends = (_avatarId: string) => {
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const handleMyCloneVoice = (avatarId: string) => {
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const handleSquareConnect = () => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  const handleSquareVoice = () => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.showModal({ title: '提示', content: '功能开发中，敬请期待', showCancel: false, confirmText: '知道了' })
  }

  // 删除分身
  const deleteAvatar = async (avatarId: string) => {
    const res = await Taro.showModal({ title: '确认删除', content: '删除后无法恢复，确定要删除这个分身吗？' })
    if (!res.confirm) return
    try {
      const result = await Network.request({
        url: `/api/avatar/${avatarId}`,
        method: 'DELETE'
      })
      console.log('deleteAvatar result:', result)
      Taro.showToast({ title: '删除成功', icon: 'success' })
      loadMyClones()
    } catch (err) {
      console.error('deleteAvatar error:', err)
      Taro.showToast({ title: '删除失败', icon: 'error' })
    }
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
              onClick={() => Taro.navigateTo({ url: '/package-avatar/pages/avatar-create/index' })}
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
                    <View className="toolbar-btn" onClick={() => openAvatarFriends(clone.id)}>
                      <Users size={15} />
                      <Text className="toolbar-label">好友</Text>
                    </View>
                    <View className="toolbar-btn" onClick={() => handleMyCloneVoice(clone.id)}>
                      <Phone size={15} />
                      <Text className="toolbar-label">通话</Text>
                    </View>
                    <View className="toolbar-btn toolbar-btn-danger" onClick={() => deleteAvatar(clone.id)}>
                      <Trash2 size={15} />
                      <Text className="toolbar-label">删除</Text>
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
                    <View className="toolbar-btn" onClick={handleSquareVoice}>
                      <Phone size={15} />
                      <Text className="toolbar-label">通话</Text>
                    </View>
                  </View>
                  <View className="follow-action-btn" onClick={handleSquareConnect}>
                    <Text className="follow-action-text">去交友</Text>
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
