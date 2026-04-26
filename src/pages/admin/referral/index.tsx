import { useState, useEffect } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Users, Award, TrendingUp, DollarSign, Pencil } from 'lucide-react-taro'
import AdminLayout from '@/components/admin/Layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import * as Network from '@/network'
import './index.css'

interface ReferralStats {
  totalReferrers: number
  totalReferred: number
  totalCommission: number
  commissionRate: number
}

interface Referrer {
  id: string
  user_id: string
  nickname: string
  avatar: string
  code: string
  referred_count: number
  commission_earned: number
  commission_paid: number
  created_at: string
}

export default function ReferralManagement() {
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrers: 0,
    totalReferred: 0,
    totalCommission: 0,
    commissionRate: 10
  })
  const [referrers, setReferrers] = useState<Referrer[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [commissionRate, setCommissionRate] = useState('10')

  useEffect(() => {
    fetchStats()
    fetchReferrers()
  }, [])

  const fetchStats = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/referral/stats' })
      if (res.data.code === 200) {
        setStats(res.data.data)
        setCommissionRate(String(res.data.data.commissionRate))
      }
    } catch (err) {
      console.error('获取推广统计失败:', err)
    }
  }

  const fetchReferrers = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/referral/list' })
      if (res.data.code === 200) {
        setReferrers(res.data.data)
      }
    } catch (err) {
      console.error('获取推广员列表失败:', err)
    }
  }

  const handleSaveRate = async () => {
    const rate = parseFloat(commissionRate)
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      Taro.showToast({ title: '请输入0-100的有效比例', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/admin/referral/settings',
        method: 'PUT',
        data: { commissionRate: rate }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '设置已保存', icon: 'success' })
        setShowSettings(false)
        fetchStats()
      }
    } catch (err) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    }
  }

  return (
    <AdminLayout title="推广管理">
      <ScrollView className="referral-page" scrollY>
        {/* 设置按钮 */}
        <View className="page-header">
          <Text className="header-title">推广数据</Text>
          <Button className="settings-btn" onClick={() => setShowSettings(true)}>
            <Pencil size={16} color="#3b82f6" />
            <Text>分佣设置</Text>
          </Button>
        </View>

        {/* 统计卡片 */}
        <View className="stats-grid">
          <View className="stat-card">
            <View className="stat-icon users">
              <Users size={24} color="#3b82f6" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">{stats.totalReferrers}</Text>
              <Text className="stat-label">推广员</Text>
            </View>
          </View>
          
          <View className="stat-card">
            <View className="stat-icon referred">
              <TrendingUp size={24} color="#10b981" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">{stats.totalReferred}</Text>
              <Text className="stat-label">邀请人数</Text>
            </View>
          </View>
          
          <View className="stat-card">
            <View className="stat-icon commission">
              <DollarSign size={24} color="#f59e0b" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">¥{stats.totalCommission.toFixed(2)}</Text>
              <Text className="stat-label">累计分佣</Text>
            </View>
          </View>
          
          <View className="stat-card">
            <View className="stat-icon rate">
              <Award size={24} color="#8b5cf6" />
            </View>
            <View className="stat-info">
              <Text className="stat-value">{stats.commissionRate}%</Text>
              <Text className="stat-label">分佣比例</Text>
            </View>
          </View>
        </View>

        {/* 推广员列表 */}
        <View className="section">
          <Text className="section-title">推广员列表</Text>
          
          <View className="referrer-list">
            {referrers.map(referrer => (
              <View key={referrer.id} className="referrer-card">
                <View className="referrer-header">
                  <View className="user-info">
                    <View className="user-avatar">
                      {referrer.avatar ? (
                        <Image className="avatar-img" src={referrer.avatar} mode="aspectFill" />
                      ) : (
                        <Text className="avatar-text">{referrer.nickname?.[0] || '?'}</Text>
                      )}
                    </View>
                    <View className="user-meta">
                      <Text className="user-name">{referrer.nickname}</Text>
                      <View className="invite-code">
                        <Text className="code-label">邀请码:</Text>
                        <Text className="code-value">{referrer.code}</Text>
                      </View>
                    </View>
                  </View>
                  <Text className="join-date">{referrer.created_at}</Text>
                </View>
                
                <View className="referrer-stats">
                  <View className="stat-box">
                    <Text className="stat-num">{referrer.referred_count}</Text>
                    <Text className="stat-label">邀请人数</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">¥{referrer.commission_earned.toFixed(2)}</Text>
                    <Text className="stat-label">累计收益</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">¥{referrer.commission_paid.toFixed(2)}</Text>
                    <Text className="stat-label">已提现</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 分佣设置弹窗 */}
        {showSettings && (
          <View className="modal-overlay">
            <View className="modal-content">
              <Text className="modal-title">分佣比例设置</Text>
              <Text className="modal-desc">
                设置推广员可获得的订单分佣比例（0-100%）
              </Text>
              
              <View className="rate-input-group">
                <Input
                  className="rate-input"
                  type="number"
                  value={commissionRate}
                  onInput={(e: any) => setCommissionRate(e.detail?.value || '0')}
                />
                <Text className="rate-unit">%</Text>
              </View>
              
              <View className="modal-actions">
                <Button className="btn-cancel" onClick={() => setShowSettings(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="btn-confirm" onClick={handleSaveRate}>
                  <Text>保存</Text>
                </Button>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </AdminLayout>
  )
}
