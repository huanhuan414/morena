// @ts-nocheck
import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { Copy, Share2, Gift, Users, ArrowLeft, Sparkles, User } from 'lucide-react-taro'
import './index.css'

export default function ReferralCenter() {
  const [stats, setStats] = useState({
    referralCode: '',
    totalInvited: 0,
  })
  const [referralList, setReferralList] = useState([])

  useShareAppMessage(() => {
    return {
      title: '邀请你加入Morena AI',
      path: `/pages/login/index?inviteCode=${stats.referralCode}`,
      imageUrl: '/assets/images/share-invite.png'
    }
  })

  useDidShow(() => {
    loadReferralData()
  })

  const loadReferralData = async () => {
    try {
      const statsRes = await Network.request({ url: '/api/referral/stats' })
      console.log('[ReferralCenter] stats response:', statsRes.data)
      const statsData = statsRes.data?.data || statsRes.data || {}

      setStats({
        referralCode: statsData.referralCode || '',
        totalInvited: statsData.totalInvited || 0,
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
          <ArrowLeft size={20} color="#fff" />
        </View>
        <View className="ref-header-center">
          <View className="ref-header-icon">
            <Gift size={20} color="#FFD700" />
          </View>
          <Text className="ref-header-title">邀请好友</Text>
          <Text className="ref-header-desc">邀请好友一起体验Morena AI</Text>
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
            好友注册时填写此邀请码，一起体验Morena AI
          </Text>
        </View>
        <View className="ref-code-actions">
          <View className="ref-btn-copy" onClick={handleCopy}>
            <Copy size={14} color="#fff" />
            <Text className="ref-btn-text">复制邀请码</Text>
          </View>
          <Button 
            className="ref-btn-share" 
            open-type="share"
            style={{
              background: 'transparent',
              border: 'none',
              padding: 0,
              margin: 0,
              lineHeight: 'normal'
            }}
          >
            <Share2 size={14} color="#7C3AED" />
            <Text className="ref-btn-text-purple">分享给好友</Text>
          </Button>
        </View>
      </View>

      {/* 统计概览 - 只保留已邀请人数 */}
      <View className="ref-stats">
        <View className="ref-stat-item">
          <View className="ref-stat-icon purple">
            <Users size={16} color="#7C3AED" />
          </View>
          <Text className="ref-stat-value">{stats.totalInvited}</Text>
          <Text className="ref-stat-label">已邀请</Text>
        </View>
      </View>

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
              <Text className="ref-step-title">好友注册</Text>
              <Text className="ref-step-desc">新用户使用邀请码完成注册</Text>
            </View>
          </View>
          <View className="ref-step">
            <View className="ref-step-num" style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
              <Text className="ref-step-num-text">3</Text>
            </View>
            <View className="ref-step-content">
              <Text className="ref-step-title">邀请成功</Text>
              <Text className="ref-step-desc">好友注册成功，邀请完成</Text>
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
            <Text className="ref-empty-hint">分享邀请码给好友，一起体验Morena AI</Text>
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
                  <Text className="ref-list-status" style={{ color: '#10B981' }}>
                    已邀请
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  )
}
