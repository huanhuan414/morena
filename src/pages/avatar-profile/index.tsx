import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useRouter, showToast, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import * as Network from '@/network'
import { 
  ArrowLeft, Wallet, ShoppingBag, Link2, Package
} from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import './index.css'

// 平台图标映射
const PLATFORM_ICONS: Record<string, string> = {
  '抖音': '🎵',
  '微信公众号': '💬',
  '小红书': '📕',
  'B站': '📺',
  '微博': '🌊',
  '快手': '⚡',
  '知乎': '📚',
  'default': '🔗'
}

// 平台颜色映射
const PLATFORM_COLORS: Record<string, string> = {
  '抖音': '#000000',
  '微信公众号': '#07C160',
  '小红书': '#FE2C55',
  'B站': '#00A1D6',
  '微博': '#E6162D',
  '快手': '#FF5000',
  '知乎': '#0084FF',
  'default': '#666666'
}

// 订单状态映射
const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  'pending': { label: '待处理', color: '#F59E0B' },
  'processing': { label: '进行中', color: '#3B82F6' },
  'completed': { label: '已完成', color: '#10B981' },
  'cancelled': { label: '已取消', color: '#9CA3AF' }
}

// 性格类型映射
const PERSONALITY_TYPES: Record<string, { icon: string; label: string }> = {
  'outgoing': { icon: '☀️', label: '外向' },
  'introverted': { icon: '🌙', label: '内向' },
  'creative': { icon: '🎨', label: '创意' },
  'rational': { icon: '🧠', label: '理性' },
  'friendly': { icon: '😊', label: '友善' },
  'professional': { icon: '💼', label: '专业' },
  'humorous': { icon: '😄', label: '幽默' },
  'gentle': { icon: '🌸', label: '温柔' }
}

interface AvatarAccount {
  id: string
  platform: string
  account_name: string
  followers: number
  total_exposure: number
  total_works: number
  engagement_rate: number
  account_url: string
  last_updated_at: string
}

interface Order {
  id: string
  title: string
  description: string
  price: number
  status: string
  created_at: string
  completed_at: string
}

interface Earnings {
  totalEarnings: number
  pendingEarnings: number
  monthlyEarnings: number
  totalOrders: number
}

interface AvatarProfile {
  id: string
  name: string
  description: string
  avatar_url: string
  level: number
  status: string
  created_at: string
  personality?: string
  style?: string
  skills?: string[]
  accounts?: AvatarAccount[]
}

export default function AvatarProfilePage() {
  const router = useRouter()
  const [avatarProfile, setAvatarProfile] = useState<AvatarProfile | null>(null)
  const [orders, setOrders] = useState<Order[]>([])
  const [earnings, setEarnings] = useState<Earnings>({
    totalEarnings: 0,
    pendingEarnings: 0,
    monthlyEarnings: 0,
    totalOrders: 0
  })
  const [loading, setLoading] = useState(true)

  useLoad(() => {
    const params = router.params
    if (params?.id) {
      fetchData(params.id)
    }
  })

  const fetchData = async (id: string) => {
    try {
      setLoading(true)
      
      const [profileRes, ordersRes, earningsRes] = await Promise.all([
        Network.request({ url: `/api/avatar/${id}` }),
        Network.request({ url: `/api/avatar/${id}/orders?page=1&pageSize=5` }),
        Network.request({ url: `/api/avatar/${id}/earnings` })
      ])
      
      if (profileRes.data?.code === 200) {
        setAvatarProfile(profileRes.data.data)
      }
      
      if (ordersRes.data?.code === 200) {
        setOrders(ordersRes.data.data?.orders || [])
      }
      
      if (earningsRes.data?.code === 200) {
        setEarnings(earningsRes.data.data)
      }
    } catch (error) {
      console.error('获取数据失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const formatMoney = (amount: number): string => {
    if (amount >= 10000) {
      return (amount / 10000).toFixed(1) + '万'
    }
    return amount.toFixed(2)
  }

  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return (num / 10000).toFixed(1) + 'w'
    }
    return num.toString()
  }

  const formatDate = (dateStr: string): string => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
  }

  const getPlatformIcon = (platform: string): string => {
    return PLATFORM_ICONS[platform] || PLATFORM_ICONS.default
  }

  const getPlatformColor = (platform: string): string => {
    return PLATFORM_COLORS[platform] || PLATFORM_COLORS.default
  }

  const getStatusInfo = (status: string) => {
    return ORDER_STATUS[status] || { label: '未知', color: '#999999' }
  }

  const getPersonalityInfo = (type: string) => {
    return PERSONALITY_TYPES[type] || { icon: '✨', label: type || '未知' }
  }

  if (loading) {
    return (
      <View className="avatar-profile-page">
        <View className="loading-container">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!avatarProfile) {
    return (
      <View className="avatar-profile-page">
        <View className="error-container">
          <Text className="error-text">分身不存在</Text>
          <Button onClick={() => navigateBack()}>返回</Button>
        </View>
      </View>
    )
  }

  const accounts = avatarProfile.accounts || []
  const personality = getPersonalityInfo(avatarProfile.personality || '')
  const skills = avatarProfile.skills || []

  return (
    <View className="avatar-profile-page">
      {/* 顶部导航 */}
      <View className="profile-header">
        <View className="header-back" onClick={() => navigateBack()}>
          <ArrowLeft size={40} color="#ffffff" />
        </View>
        <Text className="header-title">分身主页</Text>
        <View className="header-placeholder" />
      </View>

      <ScrollView className="profile-scroll" scrollY>
        {/* 头部信息卡 */}
        <View className="profile-hero">
          <View className="avatar-main">
            {avatarProfile.avatar_url ? (
              <Image 
                src={avatarProfile.avatar_url} 
                className="avatar-image" 
                mode="aspectFill"
              />
            ) : (
              <View className="avatar-fallback">
                <Text className="avatar-initial">{avatarProfile.name[0]}</Text>
              </View>
            )}
            <View className="avatar-info">
              <Text className="avatar-name">{avatarProfile.name}</Text>
              <Text className="avatar-level">Lv.{avatarProfile.level}</Text>
            </View>
          </View>

          {/* 分身简介 */}
          {avatarProfile.description && (
            <View className="avatar-bio">
              <Text className="bio-text">{avatarProfile.description}</Text>
            </View>
          )}

          {/* 分身属性标签 */}
          <View className="avatar-details">
            <View className="detail-tag">
              <Text className="detail-tag-icon">{personality.icon}</Text>
              <Text className="detail-tag-text">{personality.label}</Text>
            </View>
            {avatarProfile.style && (
              <View className="detail-tag">
                <Text className="detail-tag-icon">🎭</Text>
                <Text className="detail-tag-text">{avatarProfile.style}</Text>
              </View>
            )}
            <View className="detail-tag">
              <Text className="detail-tag-icon">📅</Text>
              <Text className="detail-tag-text">{formatDate(avatarProfile.created_at)} 创建</Text>
            </View>
          </View>

          {/* 技能标签 */}
          {skills.length > 0 && (
            <View className="skills-section">
              <Text className="skills-title">擅长技能</Text>
              <View className="skills-list">
                {skills.map((skill, index) => (
                  <View key={index} className="skill-tag">
                    <Text className="skill-tag-text">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* 收入统计卡 */}
        <View className="earnings-card">
          <View className="earnings-header">
            <Wallet size={48} color="#7B3FE4" />
            <Text className="earnings-title">收入统计</Text>
          </View>
          
          <View className="earnings-grid">
            <View className="earnings-item primary">
              <Text className="earnings-label">累计收入</Text>
              <Text className="earnings-value">¥{formatMoney(earnings.totalEarnings)}</Text>
            </View>
            <View className="earnings-item">
              <Text className="earnings-label">本月收入</Text>
              <Text className="earnings-value">¥{formatMoney(earnings.monthlyEarnings)}</Text>
            </View>
            <View className="earnings-item">
              <Text className="earnings-label">待结算</Text>
              <Text className="earnings-value">¥{formatMoney(earnings.pendingEarnings)}</Text>
            </View>
          </View>
        </View>

        {/* 绑定账号 */}
        {accounts.length > 0 && (
          <View className="section-card">
            <View className="section-header">
              <Link2 size={40} color="#7B3FE4" />
              <Text className="section-title">绑定的账号</Text>
              <Text className="section-count">{accounts.length}个</Text>
            </View>
            
            <View className="accounts-list">
              {accounts.map((account) => (
                <View key={account.id} className="account-item">
                  <View 
                    className="account-icon-wrap"
                    style={{ backgroundColor: getPlatformColor(account.platform) + '15' }}
                  >
                    <Text className="account-icon">{getPlatformIcon(account.platform)}</Text>
                  </View>
                  
                  <View className="account-info">
                    <Text className="account-platform">{account.platform}</Text>
                    <Text className="account-name">{account.account_name}</Text>
                  </View>
                  
                  <View className="account-stats">
                    <Text className="account-stat-value">{formatNumber(account.followers)}</Text>
                    <Text className="account-stat-label">粉丝</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 订单列表 */}
        <View className="section-card">
          <View className="section-header">
            <ShoppingBag size={40} color="#7B3FE4" />
            <Text className="section-title">接单记录</Text>
            <Text className="section-count">{orders.length}单</Text>
          </View>
          
          {orders.length === 0 ? (
            <View className="empty-orders">
              <Package size={80} color="#cccccc" />
              <Text className="empty-text">暂无订单</Text>
            </View>
          ) : (
            <View className="orders-list">
              {orders.map((order) => {
                const statusInfo = getStatusInfo(order.status)
                return (
                  <View key={order.id} className="order-item">
                    <View className="order-main">
                      <Text className="order-title">{order.title}</Text>
                      <Text className="order-desc" numberOfLines={1}>
                        {order.description}
                      </Text>
                    </View>
                    <View className="order-right">
                      <Text className="order-price">¥{order.price}</Text>
                      <View 
                        className="order-status"
                        style={{ backgroundColor: statusInfo.color + '20' }}
                      >
                        <View 
                          className="status-dot"
                          style={{ backgroundColor: statusInfo.color }}
                        />
                        <Text 
                          className="status-text"
                          style={{ color: statusInfo.color }}
                        >
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>

        {/* 底部占位 */}
        <View className="bottom-placeholder" />
      </ScrollView>
    </View>
  )
}
