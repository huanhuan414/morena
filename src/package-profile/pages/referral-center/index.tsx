// @ts-nocheck
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { Copy, Share2, Gift, Users, Wallet, TrendingUp, Crown, Star, Sparkles, ChevronLeft, User } from 'lucide-react-taro'
import {
  INVITER_BASE_REWARD,
  REWARD_CONDITION,
  REFERRAL_MILESTONES,
  REFERRAL_HEADER_DESC,
  STEP3_TITLE,
  STEP3_DESC,
} from '@/constants/referral-rewards'
import './index.css'

export default function ReferralCenter() {
  const [stats, setStats] = useState({
    referralCode: '',
    totalInvited: 0,
    totalReward: 0,
    pendingReward: 0,
  })
  const [referralList, setReferralList] = useState([])

  useDidShow(() => {
    loadReferralData()
  })

  const loadReferralData = async () => {
    try {
      const res = await Network.request({ url: '/api/referral/code' })
      console.log('[ReferralCenter] referral/code response:', res.data)
      const data = res.data?.data || res.data || {}
      let code = data.referralCode || data.code || ''
      if (!code) {
        const genRes = await Network.request({
          url: '/api/referral/code',
          method: 'POST',
        })
        code = genRes.data?.data?.referralCode || genRes.data?.data?.code || ''
      }

      const statsRes = await Network.request({ url: '/api/referral/stats' })
      console.log('[ReferralCenter] stats response:', statsRes.data)
      const statsData = statsRes.data?.data || statsRes.data || {}

      setStats({
        referralCode: code,
        totalInvited: statsData.totalInvited || statsData.total_invited || 0,
        totalReward: Number(statsData.totalReward || statsData.total_reward || 0),
        pendingReward: Number(statsData.pendingReward || statsData.pending_reward || 0),
      })

      const listRes = await Network.request({ url: '/api/referral/list' })
      const listData = listRes.data?.data || listRes.data || {}
      setReferralList(listData.items || listData.list || [])
    } catch (err) {
      console.error('[ReferralCenter] load error:', err)
    } finally {
      // loading complete
    }
  }

  const handleCopy = () => {
    if (!stats.referralCode) {
      Taro.showToast({ title: '邀请码生成中，请稍后再试', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: stats.referralCode,
      success: () => Taro.showToast({ title: '邀请码已复制', icon: 'success' }),
    })
  }

  const handleShareToFriend = () => {
    if (!stats.referralCode) return
    Taro.showModal({
      title: '分享给好友',
      content: `我的Morena AI邀请码: ${stats.referralCode}，快来注册创建分身，双方各得${INVITER_BASE_REWARD}元现金奖励！`,
      showCancel: false,
      confirmText: '知道了',
    })
  }

  const getStatusLabel = (status) => {
    const map = {
      pending: '待完成',
      completed: '已到账',
      expired: '已过期',
      rewarded: '已到账',
    }
    return map[status] || status
  }

  const getStatusColor = (status) => {
    const map = {
      pending: '#F59E0B',
      completed: '#10B981',
      expired: '#9CA3AF',
      rewarded: '#10B981',
    }
    return map[status] || '#9CA3AF'
  }

  const formatTime = (time) => {
    if (!time) return ''
    try {
      const date = new Date(time)
      if (Number.isNaN(date.getTime())) return time
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hours}:${minutes}`
    } catch {
      return time
    }
  }

  return (
    <View className="ref-page">
      {/* 头部渐变 */}
      <View className="ref-header">
        <View className="ref-header-decor1" />
        <View className="ref-header-decor2" />
        <View className="ref-header-decor3" />
        <View className="ref-header-back" onClick={() => Taro.navigateBack()}>
          <ChevronLeft size={24} color="#fff" strokeWidth={2.5} />
        </View>
        <View className="ref-header-center">
          <View className="ref-header-icon">
            <Gift size={20} color="#FFD700" />
          </View>
          <Text className="ref-header-title">邀请好友 赚现金</Text>
          <Text className="ref-header-desc">{REFERRAL_HEADER_DESC}</Text>
        </View>
        <View className="ref-header-badge">
          <Text className="ref-header-badge-text">奖励</Text>
        </View>
      </View>

      {/* 邀请码卡片 */}
      <View className="ref-code-card">
        <View className="ref-code-main">
          <Text className="ref-code-label">我的专属邀请码</Text>
          <View className="ref-code-value">
            <Text className="ref-code-text">{stats.referralCode || '加载中...'}</Text>
          </View>
          <Text className="ref-code-hint">
            好友注册时填写此邀请码，{REWARD_CONDITION}后双方各获{INVITER_BASE_REWARD}元
          </Text>
        </View>
        <View className="ref-code-actions">
          <View className="ref-btn-copy" onClick={handleCopy}>
            <Copy size={14} color="#fff" />
            <Text className="ref-btn-text">复制邀请码</Text>
          </View>
          <View className="ref-btn-share" onClick={handleShareToFriend}>
            <Share2 size={14} color="#7C3AED" />
            <Text className="ref-btn-text-purple">分享给好友</Text>
          </View>
        </View>
      </View>

      {/* 统计概览 */}
      <View className="ref-stats">
        <View className="ref-stat-item">
          <View className="ref-stat-icon purple">
            <Users size={16} color="#7C3AED" />
          </View>
          <Text className="ref-stat-value">{stats.totalInvited}</Text>
          <Text className="ref-stat-label">已邀请</Text>
        </View>
        <View className="ref-stat-item">
          <View className="ref-stat-icon green">
            <Wallet size={16} color="#10B981" />
          </View>
          <Text className="ref-stat-value-green">¥{stats.totalReward.toFixed(2)}</Text>
          <Text className="ref-stat-label">已到账</Text>
        </View>
        <View className="ref-stat-item">
          <View className="ref-stat-icon yellow">
            <TrendingUp size={16} color="#F59E0B" />
          </View>
          <Text className="ref-stat-value-yellow">¥{stats.pendingReward.toFixed(2)}</Text>
          <Text className="ref-stat-label">待到账</Text>
        </View>
      </View>

      {/* 阶梯奖励 */}
      {REFERRAL_MILESTONES.length > 0 && (
        <View className="ref-milestone-card">
          <View className="ref-section-row">
            <Crown size={14} color="#FFD700" />
            <Text className="ref-section-title">阶梯奖励</Text>
          </View>
          <View className="ref-milestone-list">
            {REFERRAL_MILESTONES.map((m, i) => {
              const achieved = stats.totalInvited >= m.count
              return (
                <View key={i} className={`ref-milestone-item ${achieved ? 'achieved' : ''}`}>
                  <View className="ref-milestone-badge">
                    {achieved ? (
                      <Star size={12} color="#FFD700" />
                    ) : (
                      <Text className="ref-milestone-num">{m.count}</Text>
                    )}
                  </View>
                  <Text className="ref-milestone-label">{m.label}</Text>
                  <Text className="ref-milestone-bonus">+{m.bonus}元</Text>
                </View>
              )
            })}
          </View>
          <Text className="ref-milestone-hint">累计邀请达标后，额外奖励自动发放至收益</Text>
        </View>
      )}

      {/* 邀请步骤 */}
      <View className="ref-steps-card">
        <View className="ref-section-row">
          <Sparkles size={14} color="#7C3AED" />
          <Text className="ref-section-title">邀请步骤</Text>
        </View>
        <View className="ref-steps">
          <View className="ref-step">
            <View className="ref-step-num" style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)' }}>
              <Text className="ref-step-num-text">1</Text>
            </View>
            <View className="ref-step-line" />
            <View className="ref-step-content">
              <Text className="ref-step-title">分享邀请码</Text>
              <Text className="ref-step-desc">将专属邀请码发送给好友</Text>
            </View>
          </View>
          <View className="ref-step">
            <View className="ref-step-num" style={{ background: 'linear-gradient(135deg, #6366F1, #4F46E5)' }}>
              <Text className="ref-step-num-text">2</Text>
            </View>
            <View className="ref-step-line" />
            <View className="ref-step-content">
              <Text className="ref-step-title">好友{REWARD_CONDITION}</Text>
              <Text className="ref-step-desc">新用户用邀请码注册并{REWARD_CONDITION}</Text>
            </View>
          </View>
          <View className="ref-step">
            <View className="ref-step-num" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <Text className="ref-step-num-text">3</Text>
            </View>
            <View className="ref-step-content">
              <Text className="ref-step-title">{STEP3_TITLE}</Text>
              <Text className="ref-step-desc">{STEP3_DESC}</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 邀请记录 */}
      <View className="ref-list-card">
        <View className="ref-section-row">
          <Users size={14} color="#7C3AED" />
          <Text className="ref-section-title">邀请记录</Text>
        </View>
        {referralList.length === 0 ? (
          <View className="ref-empty">
            <View className="ref-empty-icon">
              <Gift size={28} color="#A78BFA" />
            </View>
            <Text className="ref-empty-text">还没有邀请好友</Text>
            <Text className="ref-empty-hint">分享邀请码给好友，双方都能获得{INVITER_BASE_REWARD}元现金奖励</Text>
          </View>
        ) : (
          <View className="ref-list">
            {referralList.map((item, idx) => (
              <View key={idx} className="ref-list-item">
                <View className="ref-list-left">
                  <View className="ref-list-avatar">
                    <User size={18} color="#fff" />
                  </View>
                  <View className="ref-list-info">
                    <Text className="ref-list-name">{item.referredName || item.referred_name || `用户${idx + 1}`}</Text>
                    <Text className="ref-list-time">{formatTime(item.createdAt || item.created_at)}</Text>
                  </View>
                </View>
                <View className="ref-list-right">
                  <Text className="ref-list-amount">+¥{Number(item.rewardAmount || item.reward_amount || 0).toFixed(2)}</Text>
                  <Text className="ref-list-status" style={{ color: getStatusColor(item.status) }}>
                    {getStatusLabel(item.status)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 底部提示 */}
      <View className="ref-bottom-tip">
        <Text className="ref-bottom-text">奖励将在好友{REWARD_CONDITION}后自动发放至您的收益余额</Text>
      </View>
    </View>
  )
}
