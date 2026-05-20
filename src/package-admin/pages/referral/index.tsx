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
  funnelByDay?: FunnelDay[]
}

interface FunnelDay {
  day: string
  inviters: number
  invitedRegistrations: number
  bonusCount: number
  bonusAmount: number
}

interface AggregatedReferrer {
  referrerId: string
  nickname: string
  avatarUrl: string
  phoneMasked: string
  referralCode: string
  createdAt: string
  invitedCount: number
  invitedTotal: number
  pendingCount: number
  pendingAmount: number
  approvedCount: number
  approvedAmount: number
}

interface ReferralPayout {
  id: string
  payoutType: string
  referrerId: string
  userId: string
  referredId?: string | null
  orderId?: string | null
  amount: number
  status: string
  reviewReason?: string
  createdAt: string
  referrer?: {
    nickname?: string
    avatarUrl?: string
    phone?: string
    code?: string
  }
  user?: {
    nickname?: string
    avatarUrl?: string
    phone?: string
  }
}

export default function ReferralManagement() {
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrers: 0,
    totalReferred: 0,
    totalCommission: 0,
    commissionRate: 10,
    funnelByDay: []
  })
  const [referrers, setReferrers] = useState<AggregatedReferrer[]>([])
  const [payouts, setPayouts] = useState<ReferralPayout[]>([])
  const [selectedPayoutIds, setSelectedPayoutIds] = useState<string[]>([])
  const [showSettings, setShowSettings] = useState(false)
  const [commissionRate, setCommissionRate] = useState('10')

  useEffect(() => {
    fetchStats()
    fetchReferrers()
    fetchPayouts()
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
      const res = await Network.request({ url: '/api/admin/referral/referrers?days=14' })
      if (res.data.code === 200) {
        const payload = res.data.data
        const list = Array.isArray(payload?.list) ? payload.list : []
        setReferrers(list)
      }
    } catch (err) {
      console.error('获取推广员列表失败:', err)
    }
  }

  const fetchPayouts = async () => {
    try {
      const res = await Network.request({ url: '/api/admin/referral/payouts?status=pending&days=14' })
      if (res.data.code === 200) {
        const payload = res.data.data
        const list = Array.isArray(payload?.list) ? payload.list : []
        setPayouts(list)
        setSelectedPayoutIds([])
      }
    } catch (err) {
      console.error('获取待审核列表失败:', err)
    }
  }

  const togglePayoutSelection = (id: string) => {
    setSelectedPayoutIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      return [...prev, id]
    })
  }

  const handleApproveSelected = async () => {
    if (selectedPayoutIds.length === 0) {
      Taro.showToast({ title: '请选择待审核记录', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: '/api/admin/referral/payouts/approve',
        method: 'POST',
        data: { ids: selectedPayoutIds }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '已通过', icon: 'success' })
        fetchStats()
        fetchReferrers()
        fetchPayouts()
        return
      }
      Taro.showToast({ title: res.data.message || '操作失败', icon: 'none' })
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleRejectSelected = async () => {
    if (selectedPayoutIds.length === 0) {
      Taro.showToast({ title: '请选择待审核记录', icon: 'none' })
      return
    }

    const result = await Taro.showModal({
      title: '驳回原因',
      editable: true,
      placeholderText: '请输入驳回原因',
    } as any)

    if (!result.confirm) return

    try {
      const res = await Network.request({
        url: '/api/admin/referral/payouts/reject',
        method: 'POST',
        data: { ids: selectedPayoutIds, reason: (result as any)?.content || '' }
      })
      if (res.data.code === 200) {
        Taro.showToast({ title: '已驳回', icon: 'success' })
        fetchStats()
        fetchReferrers()
        fetchPayouts()
        return
      }
      Taro.showToast({ title: res.data.message || '操作失败', icon: 'none' })
    } catch (err) {
      Taro.showToast({ title: '操作失败', icon: 'none' })
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
              <Text className="stat-label">累计奖励/分佣</Text>
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

        <View className="section">
          <View className="section-header">
            <Text className="section-title">待审核发放（近14天）</Text>
            <View className="header-actions">
              <Button className="action-btn" onClick={handleApproveSelected}>
                <Text>批量通过</Text>
              </Button>
              <Button className="action-btn secondary" onClick={handleRejectSelected}>
                <Text>批量驳回</Text>
              </Button>
            </View>
          </View>

          <View className="referrer-list">
            {(Array.isArray(payouts) ? payouts : []).map((row) => (
              <View key={row.id} className="payout-card" onClick={() => togglePayoutSelection(row.id)}>
                <View className="payout-left">
                  <View className={`payout-check ${selectedPayoutIds.includes(row.id) ? 'checked' : ''}`}>
                    <Text className="check-text">{selectedPayoutIds.includes(row.id) ? '✓' : ''}</Text>
                  </View>
                  <View className="payout-meta">
                    <Text className="payout-title">
                      {row.payoutType === 'order_commission' ? '订单分佣' : '邀请奖励'}
                    </Text>
                    <Text className="payout-subtitle">
                      推广员：{row.referrer?.nickname || row.referrerId}　用户：{row.user?.nickname || row.userId}
                    </Text>
                  </View>
                </View>

                <View className="payout-right">
                  <Text className="payout-amount">¥{Number(row.amount || 0).toFixed(2)}</Text>
                  <Text className="payout-time">{row.createdAt}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 推广员列表 */}
        <View className="section">
          <Text className="section-title">邀请漏斗（近14天）</Text>
          <View className="referrer-list">
            {(stats.funnelByDay || []).map((row) => (
              <View key={row.day} className="referrer-card">
                <View className="referrer-header">
                  <Text className="user-name">{row.day}</Text>
                </View>

                <View className="referrer-stats">
                  <View className="stat-box">
                    <Text className="stat-num">{row.inviters}</Text>
                    <Text className="stat-label">活跃推广员</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">{row.invitedRegistrations}</Text>
                    <Text className="stat-label">邀请注册</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">{row.bonusCount}</Text>
                    <Text className="stat-label">奖励发放</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">¥{Number(row.bonusAmount || 0).toFixed(2)}</Text>
                    <Text className="stat-label">奖励金额</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* 推广员列表 */}
        <View className="section">
          <Text className="section-title">推广员列表</Text>
          
          <View className="referrer-list">
            {(Array.isArray(referrers) ? referrers : []).map(referrer => (
              <View key={referrer.referrerId} className="referrer-card">
                <View className="referrer-header">
                  <View className="user-info">
                    <View className="user-avatar">
                      {referrer.avatarUrl ? (
                        <Image className="avatar-img" src={referrer.avatarUrl} mode="aspectFill" />
                      ) : (
                        <Text className="avatar-text">{referrer.nickname?.[0] || '?'}</Text>
                      )}
                    </View>
                    <View className="user-meta">
                      <Text className="user-name">{referrer.nickname}</Text>
                      <View className="invite-code">
                        <Text className="code-label">邀请码:</Text>
                        <Text className="code-value">{referrer.referralCode}</Text>
                      </View>
                      {!!referrer.phoneMasked && (
                        <Text className="user-phone">{referrer.phoneMasked}</Text>
                      )}
                    </View>
                  </View>
                  <Text className="join-date">{referrer.createdAt}</Text>
                </View>
                
                <View className="referrer-stats">
                  <View className="stat-box">
                    <Text className="stat-num">{referrer.invitedCount}</Text>
                    <Text className="stat-label">近14天邀请</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">{referrer.invitedTotal}</Text>
                    <Text className="stat-label">累计邀请</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">¥{Number(referrer.pendingAmount || 0).toFixed(2)}</Text>
                    <Text className="stat-label">待审核</Text>
                  </View>
                  <View className="stat-divider" />
                  <View className="stat-box">
                    <Text className="stat-num">¥{Number(referrer.approvedAmount || 0).toFixed(2)}</Text>
                    <Text className="stat-label">已发放</Text>
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
