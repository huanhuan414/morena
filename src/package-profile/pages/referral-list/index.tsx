// @ts-nocheck
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { ArrowLeft, User, Gift, Users, DollarSign, Coins } from 'lucide-react-taro'
import './index.css'

export default function ReferralList() {
  const [referralList, setReferralList] = useState([])
  const [stats, setStats] = useState({
    totalInvited: 0,
    totalReward: 0,
    totalCoinsReward: 0,
  })
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  useDidShow(() => {
    loadReferralData(1, true)
  })

  const loadReferralData = async (pageNum, isRefresh) => {
    if (loading) return
    
    setLoading(true)
    
    try {
      // 加载邀请列表
      const listRes = await Network.request({ 
        url: '/api/referral/list',
        data: { page: pageNum, pageSize }
      })
      const listData = listRes.data?.data || listRes.data || {}
      const newList = listData.items || listData.list || []
      const totalCount = listData.total || 0
      
      if (isRefresh) {
        setReferralList(newList)
      } else {
        setReferralList(prev => [...prev, ...newList])
      }
      
      setTotal(totalCount)
      setPage(pageNum)
      setHasMore(newList.length >= pageSize)

      // 加载邀请统计（只在首次加载时）
      if (isRefresh) {
        const statsRes = await Network.request({ url: '/api/referral/stats' })
        const statsData = statsRes.data?.data || statsRes.data || {}
        setStats({
          totalInvited: statsData.totalInvited || 0,
          totalReward: statsData.totalReward || 0,
          totalCoinsReward: statsData.totalCoinsReward || 0,
        })
      }
    } catch (err) {
      console.error('[ReferralList] load error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleScrollToLower = () => {
    if (!hasMore || loading) return
    loadReferralData(page + 1, false)
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
    <View className="list-page">
      {/* 头部 */}
      <View className="list-header">
        <View className="list-header-back" onClick={() => Taro.navigateBack()}>
          <ArrowLeft size={20} color="#fff" />
        </View>
        <View className="list-header-center">
          <Text className="list-header-title">邀请记录</Text>
          <Text className="list-header-count">共{total}人</Text>
        </View>
      </View>

      {/* 统计概览 */}
      <View className="list-stats">
        <View className="list-stat-item">
          <View className="list-stat-icon purple">
            <Users size={16} color="#7C3AED" />
          </View>
          <Text className="list-stat-value">{stats.totalInvited}</Text>
          <Text className="list-stat-label">已邀请</Text>
        </View>
        <View className="list-stat-item">
          <View className="list-stat-icon gold">
            <DollarSign size={16} color="#F59E0B" />
          </View>
          <Text className="list-stat-value">{stats.totalReward}</Text>
          <Text className="list-stat-label">总返佣(元)</Text>
        </View>
        <View className="list-stat-item">
          <View className="list-stat-icon blue">
            <Coins size={16} color="#3B82F6" />
          </View>
          <Text className="list-stat-value">{stats.totalCoinsReward}</Text>
          <Text className="list-stat-label">总积分</Text>
        </View>
      </View>

      {/* 邀请记录列表 */}
      <ScrollView 
        className="list-content" 
        scrollY 
        onScrollToLower={handleScrollToLower}
        lowerThreshold={100}
      >
        {referralList.length === 0 && !loading ? (
          <View className="list-empty">
            <View className="list-empty-icon">
              <Gift size={28} color="#A78BFA" />
            </View>
            <Text className="list-empty-text">还没有邀请好友</Text>
            <Text className="list-empty-hint">分享邀请码给好友，一起体验Morena AI</Text>
          </View>
        ) : (
          <View className="list-items">
            {referralList.map((item, idx) => (
              <View key={idx} className="list-invite-card">
                {/* 卡片头部 */}
                <View className="list-card-header">
                  <View className="list-card-avatar">
                    <User size={18} color="#fff" />
                  </View>
                  <View className="list-card-info">
                    <Text className="list-card-name">{item.invitee_nickname || item.inviteeName || `用户${idx + 1}`}</Text>
                    <Text className="list-card-time">邀请时间：{formatTime(item.invite_time || item.created_at)}</Text>
                  </View>
                </View>
                
                {/* 卡片内容 */}
                {item.has_commission && item.commission_records && item.commission_records.length > 0 ? (
                  <View className="list-card-content">
                    {/* 注册奖励 */}
                    <View className="list-card-reward">
                      <Text className="list-card-reward-title">注册奖励：</Text>
                      <View className="list-card-reward-detail">
                        {item.base_reward > 0 && (
                          <Text className="list-card-reward-text">现金奖励：{item.base_reward}元</Text>
                        )}
                        <Text className="list-card-reward-text">积分奖励：{item.coins_reward || 10}积分</Text>
                      </View>
                    </View>

                    {/* 消费记录 */}
                    <View className="list-card-records">
                      <Text className="list-card-records-title">消费记录：</Text>
                      {item.commission_records.map((record, ridx) => (
                        <View key={ridx} className="list-card-record-item">
                          <Text className="list-card-record-text">
                            • {record.consumption_type === 'subscription' ? '充值会员' : '充值币'} {record.consumption_amount}元 → 返佣{record.commission_amount}元
                          </Text>
                          <Text className="list-card-record-time">
                            （{formatTime(record.commission_time)}）
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* 总返佣 */}
                    <View className="list-card-total">
                      <Text className="list-card-total-label">总返佣：</Text>
                      <Text className="list-card-total-amount">{item.total_commission}元</Text>
                    </View>
                  </View>
                ) : (
                  <View className="list-card-content">
                    {/* 注册成功提示 */}
                    <View className="list-card-success">
                      <Text className="list-card-success-text">✓ 注册成功</Text>
                      <View className="list-card-success-reward">
                        {item.base_reward > 0 && (
                          <Text className="list-card-success-hint">现金奖励：{item.base_reward}元</Text>
                        )}
                        <Text className="list-card-success-hint">积分奖励：{item.coins_reward || 10}积分</Text>
                      </View>
                    </View>

                    {/* 充值提示 */}
                    <View className="list-card-empty">
                      <Text className="list-card-empty-text">好友充值后可获得返佣</Text>
                      <Text className="list-card-empty-hint">充值会员或币，您可获得返佣奖励</Text>
                    </View>
                  </View>
                )}
              </View>
            ))}
            
            {/* 加载状态 */}
            {loading && (
              <View className="list-loading">
                <Text className="list-loading-text">加载中...</Text>
              </View>
            )}
            
            {/* 没有更多 */}
            {!hasMore && referralList.length > 0 && (
              <View className="list-no-more">
                <Text className="list-no-more-text">已加载全部 {total} 条记录</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  )
}