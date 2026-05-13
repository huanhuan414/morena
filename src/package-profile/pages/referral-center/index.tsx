import Taro, { useDidShow, showToast, setClipboardData } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import * as Network from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { formatNum } from '@/utils/format'
import { ChevronLeft, Users, Share2, Copy, Zap, TrendingUp, Clock, CircleCheck } from 'lucide-react-taro'
import './index.css'

interface ReferralStats {
  referralCode: string
  totalInvited: number
  activeInvited: number
  rewardedInvited: number
  totalReward: number
}

interface ReferralRecord {
  id: string
  invitee_id: string
  status: string
  reward_amount: number
  created_at: string
  invitee?: {
    nickname: string
    avatar: string
  }
}

export default function ReferralCenterPage() {
  const statusBarHeight = getStatusBarHeight()

  const [stats, setStats] = useState<ReferralStats>({
    referralCode: '',
    totalInvited: 0,
    activeInvited: 0,
    rewardedInvited: 0,
    totalReward: 0
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
      console.log('[ReferralCenter] stats:', res.data)
      if (res.data?.code === 200) {
        setStats(res.data.data)
      }
    } catch (error) {
      console.error('[ReferralCenter] fetchStats error:', error)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/referral/list' })
      console.log('[ReferralCenter] records:', res.data)
      if (res.data?.code === 200) {
        const data = res.data.data
        setRecords(data?.list || [])
      }
    } catch (error) {
      console.error('[ReferralCenter] fetchRecords error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyCode = () => {
    if (!stats.referralCode) {
      showToast({ title: '邀请码生成中，请稍后再试', icon: 'none' })
      return
    }
    setClipboardData({
      data: stats.referralCode,
      success: () => {
        showToast({ title: '邀请码已复制', icon: 'success' })
      },
      fail: () => {
        showToast({ title: '复制失败', icon: 'none' })
      }
    })
  }

  const handleShare = () => {
    if (!stats.referralCode) {
      showToast({ title: '邀请码生成中，请稍后再试', icon: 'none' })
      return
    }
    showToast({
      title: `我的邀请码: ${stats.referralCode}`,
      icon: 'none',
      duration: 3000
    })
  }

  return (
    <View className="referral-page">
      {/* 紫蓝渐变头部 */}
      <View className="referral-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="header-deco header-deco-1" />
        <View className="header-deco header-deco-2" />
        <View className="header-nav">
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <ChevronLeft size={22} color="#fff" />
          </View>
          <Text className="nav-title">推广中心</Text>
          <View className="nav-placeholder" />
        </View>
        <View className="header-info">
          <Text className="header-title">邀请好友，一起赚收益</Text>
          <Text className="header-desc">每成功邀请一位好友注册并创建分身，双方各获30分钟免费托管时长</Text>
        </View>
      </View>

      {/* 邀请码卡片 */}
      <View className="code-section">
        <View className="code-card">
          <View className="code-card-inner">
            <View className="code-top">
              <Zap size={18} color="#6366F1" />
              <Text className="code-label">我的专属邀请码</Text>
            </View>
            <View className="code-display">
              <Text className="code-text">{stats.referralCode || '加载中...'}</Text>
            </View>
            <View className="code-actions">
              <Button className="copy-btn" onClick={handleCopyCode}>
                <Copy size={16} color="#6366F1" />
                <Text className="action-text">复制邀请码</Text>
              </Button>
              <Button className="share-btn" onClick={handleShare}>
                <Share2 size={16} color="#fff" />
                <Text className="share-text">分享给好友</Text>
              </Button>
            </View>
          </View>
        </View>
      </View>

      {/* 统计数据 */}
      <View className="stats-section">
        <View className="stats-card">
          <View className="stat-item">
            <View className="stat-icon-wrap stat-icon-purple">
              <Users size={18} color="#6366F1" />
            </View>
            <Text className="stat-value">{formatNum(stats.totalInvited)}</Text>
            <Text className="stat-label">邀请好友</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <View className="stat-icon-wrap stat-icon-amber">
              <TrendingUp size={18} color="#F59E0B" />
            </View>
            <Text className="stat-value stat-value-amber">¥{formatNum(stats.totalReward)}</Text>
            <Text className="stat-label">累计奖励</Text>
          </View>
          <View className="stat-divider" />
          <View className="stat-item">
            <View className="stat-icon-wrap stat-icon-green">
              <Zap size={18} color="#10B981" />
            </View>
            <Text className="stat-value stat-value-green">{formatNum(stats.activeInvited)}</Text>
            <Text className="stat-label">活跃好友</Text>
          </View>
        </View>
      </View>

      {/* 邀请步骤 */}
      <View className="steps-section">
        <View className="section-header-row">
          <View className="section-dot" />
          <Text className="section-title">邀请步骤</Text>
        </View>
        <View className="steps-card">
          <View className="step-item">
            <View className="step-num-wrap">
              <Text className="step-num">1</Text>
            </View>
            <View className="step-content">
              <Text className="step-title">分享邀请码</Text>
              <Text className="step-desc">将你的专属邀请码分享给好友</Text>
            </View>
            <CircleCheck size={20} color="#6366F1" />
          </View>
          <View className="step-item">
            <View className="step-num-wrap">
              <Text className="step-num">2</Text>
            </View>
            <View className="step-content">
              <Text className="step-title">好友注册并创建分身</Text>
              <Text className="step-desc">新用户使用你的邀请码注册成功</Text>
            </View>
            <CircleCheck size={20} color="#6366F1" />
          </View>
          <View className="step-item">
            <View className="step-num-wrap">
              <Text className="step-num">3</Text>
            </View>
            <View className="step-content">
              <Text className="step-title">双方各获30分钟托管时长</Text>
              <Text className="step-desc">邀请越多，收益越多</Text>
            </View>
            <CircleCheck size={20} color="#10B981" />
          </View>
        </View>
      </View>

      {/* 邀请记录 */}
      <View className="records-section">
        <View className="section-header-row">
          <View className="section-dot" />
          <Text className="section-title">邀请记录</Text>
        </View>

        <ScrollView className="records-scroll" scrollY>
          {loading ? (
            <View className="loading-state">
              <Text className="loading-text">加载中...</Text>
            </View>
          ) : records.length === 0 ? (
            <View className="empty-state">
              <Users size={40} color="#94A3B8" />
              <Text className="empty-text">还没有邀请好友</Text>
              <Text className="empty-hint">分享邀请码给好友，双方都能获得奖励</Text>
            </View>
          ) : (
            <View className="records-list">
              {records.map(record => (
                <View key={record.id} className="record-item">
                  <View className="record-left">
                    <View className="user-avatar-wrap">
                      {record.invitee?.avatar ? (
                        <Image
                          src={record.invitee.avatar}
                          className="user-avatar"
                          mode="aspectFill"
                        />
                      ) : (
                        <View className="avatar-fallback">
                          <Text className="avatar-letter">
                            {(record.invitee?.nickname || '新')[0]}
                          </Text>
                        </View>
                      )}
                    </View>
                    <View className="user-info">
                      <Text className="user-name">{record.invitee?.nickname || '新用户'}</Text>
                      <View className="user-time">
                        <Clock size={12} color="#94A3B8" />
                        <Text className="invite-time">{record.created_at}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="record-right">
                    <Text className={`reward-amount ${record.status === 'rewarded' ? 'completed' : 'pending'}`}>
                      +¥{formatNum(record.reward_amount || 0)}
                    </Text>
                    <View className={`status-tag ${record.status}`}>
                      <Text className="status-text">
                        {record.status === 'rewarded' ? '已发放' : record.status === 'active' ? '已活跃' : '待激活'}
                      </Text>
                    </View>
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
