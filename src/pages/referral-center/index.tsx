import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useDidShow, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'
import { Gift, Users, Share2, Copy, Sparkles, TrendingUp } from 'lucide-react-taro'
import './index.css'

interface ReferralStats {
  referralCode: string
  totalReferrals: number
  totalEarnings: number
  pendingRewards: number
  completedRewards: number
}

interface ReferralRecord {
  id: string
  referred_user: {
    nickname: string
    avatar_url: string
  }
  status: 'pending' | 'completed'
  reward_amount: number
  created_at: string
}

export default function ReferralCenterPage() {
  const [stats, setStats] = useState<ReferralStats>({
    referralCode: '',
    totalReferrals: 0,
    totalEarnings: 0,
    pendingRewards: 0,
    completedRewards: 0
  })
  const [records, setRecords] = useState<ReferralRecord[]>([])
  const [loading, setLoading] = useState(false)

  useDidShow(() => {
    fetchStats()
    fetchRecords()
  })

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/referral/stats' })
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('获取邀请统计失败:', error)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/referral/list' })
      if (res.data?.code === 200) {
        setRecords(res.data.data || [])
      }
    } catch (error) {
      console.error('获取邀请记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (!stats.referralCode) {
      showToast({ title: '邀请码生成中，请稍后再试', icon: 'none' })
      return
    }
    // 复制到剪贴板
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(stats.referralCode)
      showToast({ title: '邀请码已复制', icon: 'success' })
    } else {
      showToast({ title: stats.referralCode, icon: 'none' })
    }
  }

  const handleShare = () => {
    // 小程序分享功能
    showToast({ title: '请使用小程序右上角分享功能', icon: 'none' })
  }

  return (
    <View className="referral-page">
      {/* 顶部导航 */}
      <View className="referral-header">
        <View className="header-title-wrap">
          <Gift size={24} color="#bf00ff" />
          <Text className="header-title">邀请返利</Text>
        </View>
      </View>

      {/* 邀请码卡片 */}
      <View className="code-section">
        <View className="code-card">
          <View className="code-header">
            <Text className="code-label">我的邀请码</Text>
          </View>
          <View className="code-display">
            <Text className="code-text">{stats.referralCode || '加载中...'}</Text>
          </View>
          <View className="code-actions">
            <Button className="copy-btn" onClick={handleCopyCode}>
              <Copy size={18} color="#bf00ff" />
              <Text className="action-text">复制邀请码</Text>
            </Button>
            <Button className="share-btn" onClick={handleShare}>
              <Share2 size={18} color="#fff" />
              <Text className="share-text">分享给好友</Text>
            </Button>
          </View>
        </View>
      </View>

      {/* 奖励规则说明 */}
      <View className="rules-section">
        <View className="rules-card">
          <Text className="rules-title">🎉 邀请奖励规则</Text>
          <View className="rules-list">
            <View className="rule-item">
              <Text className="rule-icon">1️⃣</Text>
              <Text className="rule-text">分享邀请码给好友</Text>
            </View>
            <View className="rule-item">
              <Text className="rule-icon">2️⃣</Text>
              <Text className="rule-text">好友注册并完成首个订单</Text>
            </View>
            <View className="rule-item">
              <Text className="rule-icon">3️⃣</Text>
              <Text className="rule-text">您获得10元奖励，好友得5元新人红包</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 统计数据 */}
      <View className="stats-section">
        <View className="stats-card">
          <View className="stat-item">
            <Users size={22} color="#00f5ff" />
            <Text className="stat-value">{stats.totalReferrals}</Text>
            <Text className="stat-label">邀请好友</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <TrendingUp size={22} color="#00ff88" />
            <Text className="stat-value">¥{stats.totalEarnings.toFixed(0)}</Text>
            <Text className="stat-label">累计奖励</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <Sparkles size={22} color="#ffaa00" />
            <Text className="stat-value">¥{stats.pendingRewards.toFixed(0)}</Text>
            <Text className="stat-label">待发放</Text>
          </View>
        </View>
      </View>

      {/* 邀请记录 */}
      <View className="records-section">
        <View className="section-header">
          <Text className="section-title">邀请记录</Text>
        </View>

        <ScrollView className="records-scroll" scrollY>
          {loading ? (
            <View className="loading-state">
              <Text className="loading-text">加载中...</Text>
            </View>
          ) : records.length === 0 ? (
            <View className="empty-state">
              <Users size={48} color="rgba(255,255,255,0.2)" />
              <Text className="empty-text">还没有邀请好友</Text>
              <Text className="empty-hint">分享邀请码给好友，双方都能获得奖励</Text>
            </View>
          ) : (
            <View className="records-list">
              {records.map(record => (
                <View key={record.id} className="record-item">
                  <View className="record-left">
                    <Image 
                      src={record.referred_user?.avatar_url || 'https://placehold.co/80x80/1a1a2e/ffffff?text=U'}
                      className="user-avatar"
                      mode="aspectFill"
                    />
                    <View className="user-info">
                      <Text className="user-name">{record.referred_user?.nickname || '新用户'}</Text>
                      <Text className="invite-time">{record.created_at}</Text>
                    </View>
                  </View>
                  <View className="record-right">
                    <Text className={`reward-amount ${record.status === 'completed' ? 'completed' : 'pending'}`}>
                      +¥{record.reward_amount.toFixed(0)}
                    </Text>
                    <Text className={`reward-status ${record.status}`}>
                      {record.status === 'completed' ? '已发放' : '待发放'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View className="bottom-space" />
        </ScrollView>
      </View>
    </View>
  )
}
