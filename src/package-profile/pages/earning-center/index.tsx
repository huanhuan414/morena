import Taro, { useDidShow, showToast, useLoad, navigateBack } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Input } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import {
  normalizeEarningOverview,
  normalizeEarningRecords,
  type EarningOverview,
  type EarningRecord,
} from '@/adapters/core-chain-dto'
import { Network } from '@/network'
import { formatNum, toNumber } from '@/utils/format'
import { ArrowDownToLine, Sparkles, ArrowLeft, X, Info } from 'lucide-react-taro'
import './index.css'

export default function EarningCenterPage() {
  const [overview, setOverview] = useState<EarningOverview>({
    balance: 0,
    totalEarnings: 0,
    completedAmount: 0,
    settlingAmount: 0,
    pendingAmount: 0,
    processingAmount: 0,
    monthlyAmount: 0,
    totalOrders: 0,
    referralCount: 0
  })
  const [records, setRecords] = useState<EarningRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'earning' | 'withdraw'>('earning')
  const [withdrawRecords, setWithdrawRecords] = useState<any[]>([])
  const [showRuleModal, setShowRuleModal] = useState(false)

  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawLoading, setWithdrawLoading] = useState(false)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmedTradeNos, setConfirmedTradeNos] = useState<Set<string>>(new Set())
  const [confirmingWithdraw, setConfirmingWithdraw] = useState<{ outTradeNo: string; amount: number; createdAt: string; mchId: string; appId: string; adminDomain: string } | null>(null)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
  })

  useDidShow(() => {
    fetchOverview()
    fetchRecords()
    fetchWithdrawRecords()
    fetchConfirmingWithdraw()
    checkActiveWithdraw()
  })

  const fetchOverview = async () => {
    try {
      const res = await Network.request({ url: '/api/earnings/overview' })
      if (res.data?.code === 200) {
        setOverview(normalizeEarningOverview(res.data?.data))
      }
    } catch (error) {
      console.error('获取收益概览失败:', error)
    }
  }

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: '/api/earnings' })
      if (res.data?.code === 200) {
        setRecords(normalizeEarningRecords(res.data?.data))
      }
    } catch (error) {
      console.error('获取收益记录失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 获取提现记录（排除failed）
  const fetchWithdrawRecords = async () => {
    try {
      const res = await Network.request({ url: '/api/withdraw/list' })
      if (res.data?.code === 200) {
        setWithdrawRecords(res.data?.data?.list || [])
      }
    } catch (error) {
      console.error('获取提现记录失败:', error)
    }
  }

  // 查询是否有进行中的提现，决定默认tab
  const checkActiveWithdraw = async () => {
    try {
      const res = await Network.request({ url: '/api/withdraw/has-active' })
      if (res.data?.code === 200 && res.data?.data?.hasActive) {
        setActiveTab('withdraw')
      }
    } catch {
      // 查询失败不影响，保持默认tab
    }
  }

  const fetchConfirmingWithdraw = async () => {
    try {
      const res = await Network.request({ url: '/api/withdraw/confirming' })
      if (res.data?.code === 200 && res.data?.data) {
        // 过滤掉前端已确认但后端异步未更新完的订单
        const data = res.data.data
        if (data.outTradeNo && confirmedTradeNos.has(data.outTradeNo)) {
          setConfirmingWithdraw(null)
        } else {
          setConfirmingWithdraw(data)
        }
      } else {
        setConfirmingWithdraw(null)
      }
    } catch {
      setConfirmingWithdraw(null)
    }
  }

  // 处理 tab 切换并刷新数据
  const handleTabChange = (tab: 'earning' | 'withdraw') => {
    setActiveTab(tab)

    // 切换 tab 时刷新概览数据
    fetchOverview()

    // 根据切换到的 tab 刷新对应数据
    if (tab === 'earning') {
      fetchRecords()
    } else if (tab === 'withdraw') {
      fetchWithdrawRecords()
    }
  }

  const getWithdrawStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      pending: { label: '待审核', color: '#ffaa00' },
      processing: { label: '审核中', color: '#00f5ff' },
      completed: { label: '已提现', color: '#4ade80' },
      rejected: { label: '已驳回', color: '#ff6b6b' },
      confirming: { label: '审核已通过', color: '#4ade80' },
      failed: { label: '失败', color: '#ff6b6b' }
    }
    return statusMap[status] || { label: status, color: '#fff' }
  }

  const handleWithdraw = () => {
    // const balance = toNumber(overview.balance)
    // if (balance < 20) {
    //   showToast({ title: '余额不足20元，无法提现', icon: 'none' })
    //   return
    // }
    // 打开提现弹窗
    setShowWithdrawModal(true)
    setWithdrawAmount('')
  }

  const handleWithdrawConfirm = async () => {
    const amount = Number(withdrawAmount)
    const balance = toNumber(overview.balance)

    if (!amount || amount <= 0) {
      showToast({ title: '请输入正确的提现金额', icon: 'none' })
      return
    }
    if (amount > balance) {
      showToast({ title: `余额不足，当前余额: ${balance.toFixed(2)}元`, icon: 'none' })
      return
    }

    // 使用公共验证函数
    if (!validateWithdrawAmount(amount)) {
      return
    }
    // 检查金额是否是20的倍数
    if (amount % 20 !== 0) {
      showToast({ title: '提现金额必须是20的倍数', icon: 'none' })
      return
    }

    setWithdrawLoading(true)
    try {
      const res = await Network.request({
        url: '/api/withdraw/apply',
        method: 'POST',
        data: { amount }
      })

      if (res.data?.code === 200) {
        Taro.showModal({ title: '提示', content: '提现申请已提交，预计一周内审核完成，需再来确认收款', showCancel: false, confirmText: '我知道了' })
        setShowWithdrawModal(false)
        setActiveTab('withdraw')
        fetchOverview()
        fetchWithdrawRecords()
      } else {
        showToast({ title: res.data?.msg || '提现失败', icon: 'none' })
      }
    } catch (error) {
      console.error('提现失败:', error)
      showToast({ title: '提现失败，请稍后重试', icon: 'none' })
    } finally {
      setWithdrawLoading(false)
    }
  }

  // 验证提现金额，返回是否有效
  const validateWithdrawAmount = (amount: number): boolean => {
    const referralCount = toNumber(overview.referralCount)
    const MIN_AMOUNT_NORMAL = 100
    const MIN_AMOUNT_VIP = 20
    const MULTIPLE = 20

    const minAmount = referralCount >= 2 ? MIN_AMOUNT_VIP : MIN_AMOUNT_NORMAL

    if (amount < minAmount) {
      showToast({
        title: referralCount >= 2
          ? `提现金额不能低于${minAmount}元`
          : `提现金额不能低于${minAmount}元，还需推荐${Math.max(0, 2 - referralCount)}人可享低门槛`,
        icon: 'none'
      })
      return false
    }

    if (amount % MULTIPLE !== 0) {
      showToast({ title: '提现金额必须是20的倍数', icon: 'none' })
      return false
    }

    return true
  }

  const handleConfirmWithdraw = async () => {
    if (!confirmingWithdraw) return
    setConfirmLoading(true)
    try {
      const { outTradeNo, mchId, appId, adminDomain } = confirmingWithdraw

      // 1. 获取 package_info
      showToast({ title: '获取授权信息中...', icon: 'loading', duration: 2000 })

      const packageRes = await Network.request({
        url: `${adminDomain}/admin/commission/withdraw/package_info?out_trade_no=${outTradeNo}`,
        method: 'GET',
      })

      if (!packageRes?.data?.package_info) {
        console.error('获取package_info失败:', packageRes)
        showToast({ title: '获取授权信息失败', icon: 'none', duration: 3000 })
        setConfirmLoading(false)
        return
      }

      const packageInfo = packageRes.data.package_info

      // 2. 调用微信授权收款
      await (Taro as any).requestMerchantTransfer({
        mchId,
        appId,
        package: packageInfo,
        success: () => {
          showToast({ title: '授权成功，转账即将到账', icon: 'success', duration: 3000 })
          setConfirmedTradeNos(prev => new Set(prev).add(outTradeNo))
          setConfirmingWithdraw(null)
          // 延迟3秒等后端异步更新状态后再刷新数据
          setTimeout(() => {
            fetchWithdrawRecords()
            fetchOverview()
          }, 3000)
        },
        fail: (err: any) => {
          console.error('授权收款失败:', err)
          if (err.errMsg && err.errMsg.includes('开发者工具')) {
            showToast({ title: '请在真机上测试授权功能', icon: 'none', duration: 3000 })
          } else {
            showToast({ title: '授权失败，请稍后重试', icon: 'none', duration: 3000 })
          }
        },
        complete: () => {
          setConfirmLoading(false)
        }
      })
    } catch (error) {
      console.error('确认提现失败:', error)
      showToast({ title: '确认提现失败', icon: 'none' })
      setConfirmLoading(false)
    }
  }

  const handleWithdrawAll = () => {
    const balance = toNumber(overview.balance)
    const referralCount = toNumber(overview.referralCount)
    const MIN_AMOUNT_VIP = 20
    const MULTIPLE = 20

    const minAmount = referralCount >= 2 ? MIN_AMOUNT_VIP : 100
    const maxMultiple = Math.floor(balance / MULTIPLE) * MULTIPLE

    if (maxMultiple < minAmount) {
      showToast({
        title: referralCount >= 2
          ? `余额不足${minAmount}元，无法提现`
          : `余额不足${minAmount}元，还需推荐${Math.max(0, 2 - referralCount)}人可享低门槛`,
        icon: 'none'
      })
      return
    }

    setWithdrawAmount(String(maxMultiple))
  }

  const getTypeInfo = (type: string) => {
    const typeMap: Record<string, { label: string; icon: string; color: string }> = {
      order_reward: { label: '订单收益', icon: '💰', color: '#00ff88' },
      referral_commission: { label: '邀请返佣', icon: '💰', color: '#00ff88' },
      referral_bonus: { label: '邀请奖励', icon: '🎁', color: '#a78bfa' },
      activity_reward: { label: '活动奖励', icon: '💸', color: '#ff6b6b' }
    }
    return typeMap[type] || { label: type, icon: '💵', color: '#fff' }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      settled: { label: '已到账', color: '#00ff88' },
      pending: { label: '结算中', color: '#ffaa00' },
      processing: { label: '结算中', color: '#00f5ff' },
      completed: { label: '已结算', color: '#4ade80' },
      rejected: { label: '已拒绝', color: '#ff6b6b' },
      expired: { label: '已过期', color: '#999999' }
    }
    return statusMap[status] || { label: status, color: '#fff' }
  }

  const formatTime = (time: string) => {
    if (!time) return ''
    try {
      const date = new Date(time)
      if (Number.isNaN(date.getTime())) return time
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}`
    } catch (e) {
      return time
    }
  }

  return (
    <View className="earning-page">
      {/* 顶部导航 */}
      <View className="earning-header" style={{ paddingTop: `${statusBarHeight + 10}px` }}>
        <View className="earning-header-bg" />
        {/* 装饰圆 */}
        <View className="earning-deco-circle earning-deco-1" />
        <View className="earning-deco-circle earning-deco-2" />
        <View className="earning-header-content">
          <View className="earning-back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <View className="earning-header-center">
            <Text className="header-title">收益中心</Text>
          </View>
          <View className="earning-header-right" />
        </View>
      </View>

      {/* 收益概览卡片 */}
      <View
        className="overview-section"
        style={{ paddingTop: `${statusBarHeight + 90}px` }}
      >
        <View className="overview-card">
          <View className="overview-main">
            <View className="balance-header">
              <Text className="overview-label">可提现余额</Text>
              <View className="help-btn" onClick={() => setShowRuleModal(true)}>
                <Info size={20} color="#fbbf24" />
              </View>
            </View>
            <View className="balance-wrap">
              <Text className="currency">¥</Text>
              <Text className="balance-amount">{formatNum(overview.balance)}</Text>
            </View>
          </View>

          <View className="overview-stats">
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.totalEarnings)}</Text>
              <Text className="stat-label">累计收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.monthlyAmount)}</Text>
              <Text className="stat-label">本月收益</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.completedAmount)}</Text>
              <Text className="stat-label">累计提现</Text>
            </View>
            <View className="stat-divider" />
            <View className="stat-col">
              <Text className="stat-value">¥{formatNum(overview.settlingAmount)}</Text>
              <Text className="stat-label">提现中</Text>
            </View>
          </View>

          <View className="action-btns">
            <Button className="withdraw-btn" onClick={handleWithdraw}>
              <ArrowDownToLine size={18} color="#fff" />
              <Text className="btn-text">申请提现</Text>
            </Button>
          </View>

          {/* 待确认提现卡片 */}
          {confirmingWithdraw && (
            <View className="confirm-withdraw-card">
              <View className="confirm-card-info">
                <View className="confirm-card-row">
                  <Text className="confirm-card-label">提现金额</Text>
                  <Text className="confirm-card-amount">¥{confirmingWithdraw.amount}</Text>
                </View>
                <View className="confirm-card-row">
                  <Text className="confirm-card-label">申请时间</Text>
                  <Text className="confirm-card-time">{formatTime(confirmingWithdraw.createdAt)}</Text>
                </View>
                <View className="confirm-card-row">
                  <Text className="confirm-card-label">状态</Text>
                  <Text className="confirm-card-status">申请已通过</Text>
                </View>

              </View>
              <Button className="confirm-card-btn" onClick={handleConfirmWithdraw} disabled={confirmLoading}>
                {confirmLoading ? '提现中...' : '立即提现'}
              </Button>
            </View>
          )}
        </View>
      </View>

      {/* 收益明细/提现明细 */}
      <View className="records-section">
        <View className="section-header">
          <View className="tab-switch">
            <View
              className={`tab-item ${activeTab === 'earning' ? 'active' : ''}`}
              onClick={() => handleTabChange('earning')}
            >
              <Text className={`tab-text ${activeTab === 'earning' ? 'active' : ''}`}>收益明细</Text>
            </View>
            <View
              className={`tab-item ${activeTab === 'withdraw' ? 'active' : ''}`}
              onClick={() => handleTabChange('withdraw')}
            >
              <Text className={`tab-text ${activeTab === 'withdraw' ? 'active' : ''}`}>提现明细</Text>
            </View>
          </View>
        </View>

        <ScrollView className="records-scroll" scrollY>
          {/* 收益明细 */}
          {activeTab === 'earning' && (
            loading ? (
              <View className="loading-state">
                <Text className="loading-text">加载中...</Text>
              </View>
            ) : records.length === 0 ? (
              <View className="empty-state">
                <Sparkles size={48} color="rgba(255,255,255,0.2)" />
                <Text className="empty-text">暂无收益记录</Text>
              </View>
            ) : (
              <View className="records-list">
                {records.map(record => {
                  const typeInfo = getTypeInfo(record.type)
                  const statusInfo = getStatusInfo(record.status)
                  return (
                    <View key={record.id} className="record-item">
                      <View className="record-left">
                        <View className="record-icon">
                          <Text>{typeInfo.icon}</Text>
                        </View>
                        <View className="record-info">
                          <Text className="record-desc">{typeInfo.label || record.description}</Text>
                          {/* 显示计算式：原始金额 × (1 - 抽成比例) = 实际金额 */}
                          <Text className="record-fee-formula">
                            接单¥{formatNum(record.amount)} × (1-平台{Math.round(record.feeRate * 100)}%) = ¥{formatNum(record.feeAmount)}
                          </Text>
                          <Text className="record-time">{formatTime(record.createdAt)}</Text>
                        </View>
                      </View>
                      <View className="record-right">
                        <Text className={`record-amount ${record.type === 'withdrawal' ? 'negative' : 'positive'}`}>
                          {record.type === 'withdrawal' ? '-' : '+'}¥{formatNum(record.feeAmount)}
                        </Text>
                        <Text className="record-status" style={{ color: statusInfo.color }}>
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          )}

          {/* 提现明细 */}
          {activeTab === 'withdraw' && (
            withdrawRecords.length === 0 ? (
              <View className="empty-state">
                <Sparkles size={48} color="rgba(255,255,255,0.2)" />
                <Text className="empty-text">暂无提现记录</Text>
              </View>
            ) : (
              <View className="records-list">
                {withdrawRecords.map(record => {
                  const statusInfo = getWithdrawStatusInfo(record.status)
                  return (
                    <View key={record.id} className="record-item">
                      <View className="record-left">
                        <View className="record-icon">
                          <Text>💸</Text>
                        </View>
                        <View className="record-info">
                          <Text className="record-desc">提现到微信零钱</Text>
                          <Text className="record-time">{formatTime(record.createdAt)}</Text>
                          {/* 拒绝时显示备注 */}
                          {record.status === 'rejected' && record.remark && (
                            <Text className="record-remark">驳回原因：{record.remark}</Text>
                          )}
                        </View>
                      </View>
                      <View className="record-right">
                        <Text className="record-amount negative">-¥{formatNum(record.amount)}</Text>
                        <Text className="record-status" style={{ color: statusInfo.color }}>
                          {statusInfo.label}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            )
          )}

          <View className="bottom-space" />
        </ScrollView>
      </View>

      {/* 提现弹窗 */}
      {showWithdrawModal && (
        <View className="withdraw-modal-overlay">
          <View className="withdraw-modal">
            <View className="withdraw-modal-header">
              <Text className="withdraw-modal-title">提现</Text>
              <View className="withdraw-modal-close" onClick={() => setShowWithdrawModal(false)}>
                <X size={20} color="#666" />
              </View>
            </View>

            <View className="withdraw-modal-body">
              <View className="withdraw-balance-info">
                <Text className="withdraw-balance-label">可提现余额</Text>
                <Text className="withdraw-balance-value">¥{formatNum(overview.balance)}</Text>
              </View>

              <View className="withdraw-input-wrapper">
                <Text className="withdraw-input-label">提现金额</Text>
                <View className="withdraw-input-box">
                  <Text className="withdraw-input-prefix">¥</Text>
                  <Input
                    className="withdraw-input"
                    type="digit"
                    placeholder="请输入提现金额"
                    value={withdrawAmount}
                    onInput={(e) => setWithdrawAmount(e.detail.value)}
                  />
                </View>
                <View className="withdraw-all-btn" onClick={handleWithdrawAll}>
                  <Text className="withdraw-all-text">全部提现</Text>
                </View>

                {/* 门槛说明 */}
                <View className="withdraw-threshold-tip">
                  <Text className="threshold-text">
                    {overview.referralCount >= 2
                      ? '✓ 已降低门槛，最低提现20元'
                      : '✗ 未降低门槛，最低提现100元'
                    }
                  </Text>
                  {overview.referralCount < 2 && (
                    <View className="invite-btn" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/referral-center/index' })}>
                      立即邀请
                    </View>
                  )}
                </View>
              </View>

              <View className="withdraw-tips">
                <Text className="withdraw-tip-item">• 推荐2人及以上：最低提现20元</Text>
                <Text className="withdraw-tip-item">• 未推荐2人：最低提现100元</Text>
                <Text className="withdraw-tip-item">• 提现金额必须是20的倍数</Text>
                {/* <Text className="withdraw-tip-item">• 提现将直接到微信零钱 </Text> */}
                <Text className="withdraw-tip-item">• 预计一周内到账，提现成功后不可撤销</Text>
              </View>
            </View>

            <View className="withdraw-modal-footer">
              <Button
                className="withdraw-cancel-btn"
                onClick={() => setShowWithdrawModal(false)}
              >
                取消
              </Button>
              <Button
                className="withdraw-confirm-btn"
                onClick={handleWithdrawConfirm}
                disabled={withdrawLoading}
              >
                {withdrawLoading ? '处理中...' : '确认提现'}
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 提现规则说明弹窗 */}
      {showRuleModal && (
        <View className="rule-modal-overlay" onClick={() => setShowRuleModal(false)}>
          <View className="rule-modal" onClick={(e) => e.stopPropagation()}>
            <View className="rule-modal-header">
              <View className="rule-modal-icon">
                <Info size={28} color="#fff" />
              </View>
              <Text className="rule-modal-title">提现规则说明</Text>
            </View>
            <View className="rule-modal-body">
              {/* 用户当前状态 */}
              <View className="rule-status-card">
                <Text className="rule-status-title">您的当前状态</Text>
                <View className="rule-status-content">
                  <Text className="rule-status-label">已推荐好友：</Text>
                  <Text className="rule-status-value">
                    {overview.referralCount} 人
                  </Text>
                  <Text className="rule-status-desc">
                    {overview.referralCount >= 2 ? '，已满足低门槛提现条件' : `，还需再推荐${Math.max(0, 2 - overview.referralCount)}人`}
                  </Text>
                </View>
                <View className="rule-status-content">
                  <Text className="rule-status-label">您的提现门槛：</Text>
                  <Text className="rule-status-value">
                    {overview.referralCount >= 2 ? '20元起' : '100元起'}
                  </Text>
                </View>
              </View>

              <View className="rule-item">
                <View className="rule-number">1</View>
                <View className="rule-content">
                  <Text className="rule-title">低门槛提现</Text>
                  <Text className="rule-desc">推荐 <Text className="rule-highlight">2人及以上</Text> 好友注册，即可享受最低 <Text className="rule-highlight">20元</Text> 提现门槛</Text>
                </View>
              </View>
              <View className="rule-item">
                <View className="rule-number">2</View>
                <View className="rule-content">
                  <Text className="rule-title">普通提现</Text>
                  <Text className="rule-desc">未达到推荐要求，最低提现金额为 <Text className="rule-highlight">100元</Text></Text>
                </View>
              </View>
              <View className="rule-item">
                <View className="rule-number">3</View>
                <View className="rule-content">
                  {/* <Text className="rule-title">提现倍数</Text> */}
                  <Text className="rule-desc">提现金额必须是 <Text className="rule-highlight">20元</Text> 的倍数（如：20元、40元、60元...）</Text>
                </View>
              </View>
              <View className="rule-item">
                <View className="rule-number">4</View>
                <View className="rule-content">
                  <Text className="rule-desc">预计 <Text className="rule-highlight">一周</Text> 内到账，提现成功后不可撤销</Text>
                </View>
              </View>
              {/* <View className="rule-item">
                <View className="rule-number">4</View>
                <View className="rule-content">
                  <Text className="rule-title">到账方式</Text>
                  <Text className="rule-desc">提现申请提交后，管理员审核通过后直接转入您的 <Text className="rule-highlight">微信零钱</Text></Text>
                </View>
              </View> */}
            </View>
            <View className="rule-modal-footer">
              <View className="rule-modal-close" onClick={() => setShowRuleModal(false)}>
                <Text>我知道了</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
