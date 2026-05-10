import { useState } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro, { useLoad, navigateTo, switchTab } from '@tarojs/taro'
import * as Network from '@/network'
import { User, MapPin, Star, Zap, Heart, Sparkles, Send } from 'lucide-react-taro'
import { getAvatarStyleClass } from '@/utils/avatar-style'
import './index.css'

interface RecommendedAvatar {
  id: string
  name: string
  avatar_url: string
  level: number
  personality: string
  abilities: string[]
  exp: number
  appearance_style?: string
  distance?: number
  matchScore: number
  description: string
  location?: {
    latitude: number
    longitude: number
  }
}

export default function AvatarRecommendPage() {
  const [avatars, setAvatars] = useState<RecommendedAvatar[]>([])
  const [loading, setLoading] = useState(true)
  const [currentAvatarId, setCurrentAvatarId] = useState<string>('')
  const [userLocation, setUserLocation] = useState<{
    latitude: number | null
    longitude: number | null
  }>({
    latitude: null,
    longitude: null
  })
  const [activeFilter, setActiveFilter] = useState<'all' | 'level' | 'distance' | 'personality'>('all')
  const [orderParams, setOrderParams] = useState<any>(null)
  const [selectedAvatars, setSelectedAvatars] = useState<string[]>([])

  useLoad(() => {
    // 解析URL参数
    const pages = Taro.getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const options = currentPage?.options || {}
    
    if (options.orderParams) {
      try {
        const params = JSON.parse(decodeURIComponent(options.orderParams))
        console.log('接收到的订单参数:', params)
        setOrderParams(params)
      } catch (err) {
        console.error('解析订单参数失败:', err)
      }
    }
    
    loadCurrentAvatar()
    loadRecommendations()
  })

  const loadCurrentAvatar = async () => {
    try {
      const res = await Network.request({
        url: '/api/avatar'
      })
      console.log('获取分身列表:', res.data)
      if (res.data?.data?.length > 0) {
        setCurrentAvatarId(res.data.data[0].id)
      }
    } catch (err) {
      console.error('获取分身失败:', err)
    }
  }

  const loadRecommendations = async () => {
    try {
      setLoading(true)

      // 1. 先获取用户位置
      let location = userLocation
      try {
        const locationRes = await Taro.getLocation({
          type: 'wgs84'
        })
        location = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
        setUserLocation(location)
        console.log('获取用户位置成功:', location)
      } catch (error) {
        console.warn('获取位置失败，将使用默认推荐:', error)
      }

      // 2. 请求推荐分身（使用获取到的位置）
      console.log('请求推荐分身，location:', location)
      const res = await Network.request({
        url: '/api/avatar/recommendations',
        method: 'POST',
        data: {
          location: location,
          limit: 20
        }
      })

      console.log('推荐分身响应:', res)

      if (res.data?.code === 200) {
        const data = res.data.data
        const recommendations = Array.isArray(data) ? data : (data?.recommendations || data?.data || [])
        console.log('获取到推荐分身数量:', recommendations.length)
        setAvatars(recommendations)

        if (recommendations.length === 0) {
          Taro.showToast({
            title: '暂无推荐分身',
            icon: 'none',
            duration: 2000
          })
        }
      } else {
        console.error('推荐分身API返回错误:', res.data)
        Taro.showToast({
          title: res.data?.msg || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('加载推荐失败:', error)
      Taro.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const getFilteredAvatars = () => {
    if (activeFilter === 'all') return avatars

    return avatars.filter(avatar => {
      switch (activeFilter) {
        case 'level':
          return (avatar.level || 0) >= 1
        case 'distance':
          return avatar.distance !== undefined && avatar.distance < 500
        case 'personality':
          return avatar.matchScore >= 50
        default:
          return true
      }
    })
  }

  const filteredAvatars = getFilteredAvatars()

  const sendFriendRequest = async (avatarId: string) => {
    if (!currentAvatarId) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }
    try {
      const res = await Network.request({
        url: '/api/avatar/friend-request',
        method: 'POST',
        data: { 
          avatar_id: currentAvatarId,
          target_avatar_id: avatarId 
        }
      })

      if (res.data?.code === 200) {
        Taro.showToast({
          title: '已发送好友请求',
          icon: 'success'
        })
      } else {
        Taro.showToast({
          title: res.data?.msg || '发送失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('发送好友请求失败:', error)
      Taro.showToast({
        title: '发送失败',
        icon: 'none'
      })
    }
  }

  const viewAvatar = (avatarId: string) => {
    navigateTo({
      url: `/pages/avatar-profile/index?avatarId=${avatarId}`
    })
  }

  const handleSkip = () => {
    if (orderParams) {
      // 有订单参数，跳转到我的分身页面
      switchTab({ url: '/pages/avatar/avatar-manage/index' })
    } else {
      // 跳过推荐，直接跳转回分身列表（我的分身页面）
      switchTab({ url: '/pages/avatar/avatar-manage/index' })
    }
  }

  // 切换选择分身
  const toggleSelectAvatar = (avatarId: string) => {
    setSelectedAvatars(prev => {
      if (prev.includes(avatarId)) {
        return prev.filter(id => id !== avatarId)
      } else {
        // 根据订单要求限制选择数量
        const maxCount = orderParams?.avatarCount || 1
        if (prev.length >= maxCount) {
          Taro.showToast({ title: `最多选择${maxCount}个分身`, icon: 'none' })
          return prev
        }
        return [...prev, avatarId]
      }
    })
  }

  // 发布任务
  const publishOrder = async () => {
    if (selectedAvatars.length === 0) {
      Taro.showToast({ title: '请先选择分身', icon: 'none' })
      return
    }

    if (!currentAvatarId) {
      Taro.showToast({ title: '请先选择你的分身', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        header: { 'x-user-id': currentAvatarId },
        data: {
          title: orderParams?.title,
          description: orderParams?.description,
          content_type: orderParams?.contentType,
          platforms: orderParams?.platforms,
          requirements: orderParams?.requirements,
          avatar_count: selectedAvatars.length,
          quantity_per_avatar: orderParams?.quantityPerAvatar || 1,
          selected_avatar_ids: selectedAvatars,
          total_price: orderParams?.totalPrice || 0,
        },
      })

      if (res.data?.code === 200 || res.data?.code === 0) {
        Taro.showToast({ title: '订单发布成功', icon: 'success' })
        setTimeout(() => {
          Taro.switchTab({ url: '/pages/order/order-list/index' })
        }, 1500)
      } else {
        Taro.showToast({ title: res.data?.msg || '发布失败', icon: 'none' })
      }
    } catch (error) {
      console.error('发布订单失败:', error)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    }
  }

  const getMatchReason = (avatar: RecommendedAvatar): string => {
    const reasons: string[] = []

    if (avatar.distance !== undefined && avatar.distance < 50) {
      reasons.push('距离近')
    }

    if ((avatar.matchScore || 0) >= 80) {
      reasons.push('性格匹配度高')
    }

    if (avatar.abilities && avatar.abilities.length > 0) {
      reasons.push('技能互补')
    }

    if ((avatar.level || 0) >= 10) {
      reasons.push('优质分身')
    }

    return reasons.join(' · ')
  }

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return '#06b6d4' // 青色
    if (score >= 60) return '#ffaa00' // 橙色
    return '#94a3b8' // 灰色
  }

  return (
    <View className="recommend-page">
      {/* 订单信息头部 */}
      {orderParams && (
        <View className="order-info-header">
          <View className="order-info-content">
            <Text className="order-title">{orderParams.title}</Text>
            <View className="order-tags">
              {orderParams.platforms?.map((p: string) => (
                <Text key={p} className="order-platform-tag">{p}</Text>
              ))}
              <Text className="order-count-tag">需 {orderParams.avatarCount || 1} 个分身</Text>
            </View>
          </View>
          <View 
            className="publish-btn"
            onClick={publishOrder}
          >
            <Text className="publish-btn-text">立即发布</Text>
          </View>
        </View>
      )}

      {/* 头部 */}
      <View className="page-header">
        <Text className="page-title">{orderParams ? '选择接单分身' : '推荐分身'}</Text>
        <Text className="page-subtitle">
          {orderParams ? `已选 ${selectedAvatars.length}/${orderParams.avatarCount || 1} 个分身` : '为你精选的优质AI分身'}
        </Text>
      </View>

      {/* 推荐理由标签 */}
      <ScrollView className="filter-scroll" scrollX>
        <View className="filter-tags">
          <View
            className={`filter-tag ${activeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setActiveFilter('all')}
          >
            <Sparkles size={16} color={activeFilter === 'all' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">综合推荐</Text>
          </View>
          <View
            className={`filter-tag ${activeFilter === 'level' ? 'active' : ''}`}
            onClick={() => setActiveFilter('level')}
          >
            <Star size={16} color={activeFilter === 'level' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">高等级</Text>
          </View>
          <View
            className={`filter-tag ${activeFilter === 'distance' ? 'active' : ''}`}
            onClick={() => setActiveFilter('distance')}
          >
            <MapPin size={16} color={activeFilter === 'distance' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">距离近</Text>
          </View>
          <View
            className={`filter-tag ${activeFilter === 'personality' ? 'active' : ''}`}
            onClick={() => setActiveFilter('personality')}
          >
            <Heart size={16} color={activeFilter === 'personality' ? '#06b6d4' : '#94a3b8'} />
            <Text className="filter-text">性格匹配</Text>
          </View>
        </View>
      </ScrollView>

      {/* 分身列表 */}
      <ScrollView className="avatar-list" scrollY>
        {loading ? (
          <View className="loading-container">
            <Text className="loading-text">正在为你推荐...</Text>
          </View>
        ) : filteredAvatars.length === 0 ? (
          <View className="empty-container">
            <User size={64} color="#cbd5e1" />
            <Text className="empty-text">
              {activeFilter === 'all' ? '暂无推荐分身' : '没有符合条件的分身'}
            </Text>
            <Text className="empty-hint">
              {activeFilter === 'all' ? '稍后再来看看吧' : '试试其他筛选条件'}
            </Text>
          </View>
        ) : (
          filteredAvatars.map((avatar, index) => (
            <View 
              key={avatar.id} 
              className="avatar-card"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              {/* 左侧头像和基本信息 */}
              <View className="avatar-info-section">
                <View className="avatar-avatar-container">
                  <View className="avatar-glow" />
                  <Image 
                    src={avatar.avatar_url}
                    className={`avatar-avatar-img ${getAvatarStyleClass(avatar.appearance_style)}`}
                    mode="aspectFill"
                  />
                  <View className="avatar-level-badge">
                    <Text className="level-text">Lv.{avatar.level}</Text>
                  </View>
                </View>

                <View className="avatar-details">
                  <Text className="avatar-name">{avatar.name}</Text>
                  <View className="avatar-meta">
                    <View className="meta-tag">
                      <Star size={12} color="#fbbf24" />
                      <Text className="meta-text">{(avatar.exp || 0)} EXP</Text>
                    </View>
                    {avatar.distance !== undefined && (
                      <View className="meta-tag">
                        <MapPin size={12} color="#06b6d4" />
                        <Text className="meta-text">{avatar.distance.toFixed(1)}km</Text>
                      </View>
                    )}
                  </View>
                  <View className="personality-tags">
                    <Text className="personality-tag">{avatar.personality || '通用型'}</Text>
                  </View>
                  <Text className="avatar-desc">{avatar.description || '暂无描述'}</Text>
                </View>
              </View>

              {/* 匹配度分数 */}
              <View className="match-score-section">
                <View className="match-score-circle" style={{ borderColor: getMatchScoreColor(avatar.matchScore || 0) }}>
                  <Text className="match-score-text" style={{ color: getMatchScoreColor(avatar.matchScore || 0) }}>
                    {avatar.matchScore || 0}
                  </Text>
                  <Text className="match-score-label">匹配度</Text>
                </View>
                <Text className="match-reason">{getMatchReason(avatar)}</Text>
              </View>

              {/* 技能标签 */}
              <View className="abilities-section">
                {(avatar.abilities || []).slice(0, 3).map((ability, idx) => (
                  <View key={idx} className="ability-badge">
                    <Zap size={12} color="#06b6d4" />
                    <Text className="ability-text">{ability}</Text>
                  </View>
                ))}
              </View>

              {/* 操作按钮 */}
              <View className="action-buttons">
                {orderParams ? (
                  <>
                    <View 
                      className={`action-btn ${selectedAvatars.includes(avatar.id) ? 'selected' : 'secondary'}`}
                      onClick={() => toggleSelectAvatar(avatar.id)}
                    >
                      {selectedAvatars.includes(avatar.id) ? (
                        <>
                          <Text className="action-text">已选择</Text>
                        </>
                      ) : (
                        <Text className="action-text">选择分身</Text>
                      )}
                    </View>
                    <View 
                      className="action-btn secondary"
                      onClick={() => viewAvatar(avatar.id)}
                    >
                      <Text className="action-text">查看详情</Text>
                    </View>
                  </>
                ) : (
                  <>
                    <View 
                      className="action-btn secondary"
                      onClick={() => viewAvatar(avatar.id)}
                    >
                      <Text className="action-text">查看动态</Text>
                    </View>
                    <View 
                      className="action-btn primary"
                      onClick={() => sendFriendRequest(avatar.id)}
                    >
                      <Send size={16} color="#ffffff" />
                      <Text className="action-text">添加好友</Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* 全局底部按钮 */}
      <View
        style={{
          position: 'fixed',
          bottom: 50,
          left: 16,
          right: 16,
          zIndex: 100
        }}
      >
        {orderParams ? (
          <View className="confirm-publish-bar">
            <View className="selected-summary">
              <Text className="summary-text">已选分身</Text>
              <Text className="summary-count">{selectedAvatars.length}/{orderParams.avatarCount || 1}</Text>
            </View>
            <View 
              className={`confirm-publish-btn ${selectedAvatars.length > 0 ? 'active' : 'disabled'}`}
              onClick={selectedAvatars.length > 0 ? publishOrder : undefined}
            >
              <Text className="confirm-text">确认发布任务</Text>
            </View>
          </View>
        ) : (
          <View
            className="skip-btn-full"
            onClick={handleSkip}
          >
            <Text className="skip-text-full">跳过，暂不添加</Text>
          </View>
        )}
      </View>
    </View>
  )
}
