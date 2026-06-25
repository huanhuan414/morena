// @ts-nocheck
import { View, Text, Button, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useState } from 'react'
import { Network } from '@/network'
import { Copy, Share2, Gift, Users, ArrowLeft, Sparkles, User, TrendingUp, Coins, Crown, Clock, Star, ChevronRight, Zap, Target, Medal, Info, DollarSign, Shield, X, Download, Image as ImageIcon, QrCode } from 'lucide-react-taro'
import './index.css'

export default function ReferralCenter() {
  const [stats, setStats] = useState({
    referralCode: '',
    totalInvited: 0,
    totalReward: 0,
    totalCoinsReward: 0,
  })
  const [tierInfo, setTierInfo] = useState({
    totalInvites: 0,
    currentTier: null,
    allTiers: [
      { id: 'tier_1', tier_level: 1, min_invites: 0, max_invites: 5, base_reward: 0, coins_reward: 10, commission_rate: 0, extra_reward: null },
      { id: 'tier_2', tier_level: 2, min_invites: 5, max_invites: 10, base_reward: 1, coins_reward: 10, commission_rate: 0.1, extra_reward: null },
      { id: 'tier_3', tier_level: 3, min_invites: 10, max_invites: 20, base_reward: 1, coins_reward: 15, commission_rate: 0.15, extra_reward: null },
      { id: 'tier_4', tier_level: 4, min_invites: 20, max_invites: 50, base_reward: 1, coins_reward: 15, commission_rate: 0.2, extra_reward: null },
      { id: 'tier_5', tier_level: 5, min_invites: 50, max_invites: -1, base_reward: 1, coins_reward: 20, commission_rate: 0.2, extra_reward: '价值298元礼品' }
    ],
  })
  const [dailyLimit, setDailyLimit] = useState({
    allowed: true,
    current: 0,
    limit: 10,
  })
  const [referralList, setReferralList] = useState([])
  const [showImageModal, setShowImageModal] = useState(false)
  const [posterImageUrl, setPosterImageUrl] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useShareAppMessage(() => {
    return {
      // title: '真的！莫瑞娜邀请好友有现金+20%返利！',
      title: '创建分身，即可永久免费接单，享邀请20%返利！',
      path: `/pages/login/index?inviteCode=${stats.referralCode}`,
      imageUrl: 'https://voic.51webjs.com/tos-cn-i-699z2ac540/user%2Fc90c11aa5dae2c830a32ab382a59071e.png~tplv-699z2ac540-image.png',
    }
  })

  useDidShow(() => {
    loadReferralData()
  })

  const loadReferralData = async () => {
    try {
      // 加载邀请统计
      const statsRes = await Network.request({ url: '/api/referral/stats' })
      const statsData = statsRes.data?.data || statsRes.data || {}
      setStats({
        referralCode: statsData.referralCode || '',
        totalInvited: statsData.totalInvited || 0,
        totalReward: statsData.totalReward || 0,
        totalCoinsReward: statsData.totalCoinsReward || 0,
      })

      // 加载阶梯信息
      const tierRes = await Network.request({ url: '/api/referral/tier' })
      const tierData = tierRes.data?.data || tierRes.data || {}
      console.log('[ReferralCenter] tierData:', tierData)
      console.log('[ReferralCenter] allTiers:', tierData.allTiers)

      setTierInfo({
        totalInvites: tierData.totalInvites || 0,
        currentTier: tierData.currentTier || null,
        allTiers: tierData.allTiers || [],
      })

      // 加载每日限制
      const limitRes = await Network.request({ url: '/api/referral/daily-limit' })
      const limitData = limitRes.data?.data || limitRes.data || {}
      setDailyLimit({
        allowed: limitData.allowed || true,
        current: limitData.current || 0,
        limit: limitData.limit || 10,
      })

      // 加载邀请列表
      const listRes = await Network.request({ url: '/api/referral/list' })
      const listData = listRes.data?.data || listRes.data || {}
      setReferralList(listData.items || listData.list || [])
    } catch (err) {
      console.error('[ReferralCenter] load error:', err)
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

  const handleGenerateImage = async () => {
    if (!stats.referralCode) {
      Taro.showToast({ title: '邀请码生成中，请稍后再试', icon: 'none' })
      return
    }

    setIsGenerating(true)
    try {
      // 生成小程序二维码链接
      const qrCodeUrl = `pages/login/index?inviteCode=${stats.referralCode}`

      const res = await Network.request({
        url: '/api/referral/qrcode',
        method: 'POST',
        data: {
          content: qrCodeUrl,
        },
      })

      if (res.data && res.data.data && res.data.data.imageUrl) {
        setPosterImageUrl(res.data.data.imageUrl)
        setShowImageModal(true)
      } else {
        Taro.showToast({ title: '生成图片失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[ReferralCenter] generate image error:', error)
      Taro.showToast({ title: '生成图片失败', icon: 'none' })
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownloadImage = () => {
    if (!posterImageUrl) return

    Taro.showLoading({ title: '保存中...' })
    Taro.downloadFile({
      url: posterImageUrl,
      success: (res) => {
        if (res.statusCode === 200) {
          Taro.saveImageToPhotosAlbum({
            filePath: res.tempFilePath,
            success: () => {
              Taro.hideLoading()
              Taro.showToast({ title: '保存成功', icon: 'success' })
              setShowImageModal(false)
            },
            fail: () => {
              Taro.hideLoading()
              Taro.showToast({ title: '保存失败，请检查相册权限', icon: 'none' })
            },
          })
        }
      },
      fail: () => {
        Taro.hideLoading()
        Taro.showToast({ title: '下载失败', icon: 'none' })
      },
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
          <Text className="ref-header-desc">邀请好友一起体验Morena AI 领现金大奖</Text>
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
        <View className="ref-code-actions-row2">
          <View className="ref-btn-generate" onClick={handleGenerateImage}>
            <QrCode size={14} color="#fff" />
            <Text className="ref-btn-text-white">{isGenerating ? '海报生成中...' : '邀请海报'}</Text>
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
          <View className="ref-stat-icon gold">
            <DollarSign size={16} color="#F59E0B" />
          </View>
          <Text className="ref-stat-value">{stats.totalReward}</Text>
          <Text className="ref-stat-label">总返佣(元)</Text>
        </View>
        <View className="ref-stat-item">
          <View className="ref-stat-icon gold">
            <Coins size={16} color="#F59E0B" />
          </View>
          <Text className="ref-stat-value">{stats.totalCoinsReward}</Text>
          <Text className="ref-stat-label">邀请积分</Text>
        </View>
        <View className="ref-stat-item">
          <View className="ref-stat-icon blue">
            <Clock size={16} color="#3B82F6" />
          </View>
          <Text className="ref-stat-value">{dailyLimit.current}</Text>
          <Text className="ref-stat-label">今日邀请</Text>
        </View>
        <View className="ref-stat-item">
          <View className="ref-stat-icon green">
            <TrendingUp size={16} color="#10B981" />
          </View>
          <Text className="ref-stat-value">{tierInfo.currentTier?.tier_level || 1}</Text>
          <Text className="ref-stat-label">阶梯等级</Text>
        </View>
      </View>

      {/* 每日限制提示 */}
      {!dailyLimit.allowed && (
        <View className="ref-limit-warning">
          <Zap size={14} color="#EF4444" />
          <Text className="ref-limit-warning-text">
            今日邀请已达上限（{dailyLimit.current}/{dailyLimit.limit}人）
          </Text>
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
              <Text className="ref-step-title">好友注册</Text>
              <Text className="ref-step-desc">新用户使用邀请码注册并创建分身，享会员首冲8折</Text>
            </View>
          </View>
          <View className="ref-step">
            <View className="ref-step-num" style={{ background: 'linear-gradient(135deg, #4F46E5, #3B82F6)' }}>
              <Text className="ref-step-num-text">3</Text>
            </View>
            <View className="ref-step-line" />
            <View className="ref-step-content">
              <Text className="ref-step-title">邀请成功</Text>
              <Text className="ref-step-desc">注册成功并创建分身即可获得基础奖励</Text>
            </View>
          </View>
          <View className="ref-step">
            <View className="ref-step-num" style={{ background: 'linear-gradient(135deg, #3B82F6, #10B981)' }}>
              <Text className="ref-step-num-text">4</Text>
            </View>
            <View className="ref-step-content">
              <Text className="ref-step-title">好友充值</Text>
              <Text className="ref-step-desc">好友充值会员或币，您获得返佣</Text>
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
            {referralList.slice(0, 3).map((item, idx) => (
              <View key={idx} className="ref-invite-card">
                {/* 卡片头部 */}
                <View className="ref-card-header">
                  <View className="ref-card-avatar">
                    <User size={18} color="#fff" />
                  </View>
                  <View className="ref-card-info">
                    <Text className="ref-card-name">{item.invitee_nickname || item.inviteeName || `用户${idx + 1}`}</Text>
                    <Text className="ref-card-time">邀请时间：{formatTime(item.invite_time || item.created_at)}</Text>
                  </View>
                </View>

                {/* 卡片内容 */}
                {item.has_commission && item.commission_records && item.commission_records.length > 0 ? (
                  <View className="ref-card-content">
                    {/* 消费记录 */}
                    <View className="ref-card-records">
                      <Text className="ref-card-records-title">消费记录：</Text>
                      {item.commission_records.map((record, ridx) => (
                        <View key={ridx} className="ref-card-record-item">
                          <Text className="ref-card-record-text">
                            • {record.consumption_type === 'subscription' ? '充值会员' : '充值币'} {record.consumption_amount}元 → 返佣{record.commission_amount}元
                          </Text>
                          <Text className="ref-card-record-time">
                            （{formatTime(record.commission_time)}）
                          </Text>
                        </View>
                      ))}
                    </View>

                    {/* 总返佣 */}
                    <View className="ref-card-total">
                      <Text className="ref-card-total-label">总返佣：</Text>
                      <Text className="ref-card-total-amount">{item.total_commission}元</Text>
                    </View>
                  </View>
                ) : (
                  <View className="ref-card-empty">
                    <Text className="ref-card-empty-text">提示：好友还未充值</Text>
                    <Text className="ref-card-empty-hint">充值后您可获得返佣奖励</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
        {referralList.length > 3 && (
          <View className="ref-more-btn-bottom" onClick={() => Taro.navigateTo({ url: '/package-profile/pages/referral-list/index' })}>
            <Text className="ref-more-text">查看全部 {referralList.length} 条记录</Text>
            <ChevronRight size={14} color="#7C3AED" />
          </View>
        )}
      </View>

      {/* 阶梯奖励表格 */}
      <View className="ref-tier-table-card">
        <View className="ref-section-row">
          <Crown size={14} color="#7C3AED" />
          <Text className="ref-section-title">阶梯奖励</Text>
        </View>

        {/* 表格头部 */}
        <View className="ref-tier-table-header">
          <View className="ref-tier-th">
            <Text className="ref-tier-th-text">条件</Text>
          </View>
          <View className="ref-tier-th">
            <Text className="ref-tier-th-text">基础奖励</Text>
          </View>
          <View className="ref-tier-th">
            <Text className="ref-tier-th-text">返佣</Text>
          </View>
        </View>

        {/* 表格内容 */}
        <View className="ref-tier-table-body">
          {tierInfo.allTiers.map((tier, idx) => {
            return (
              <View key={idx} className={`ref-tier-row ${tierInfo.currentTier?.tier_level === tier.tier_level ? 'active' : ''}`}>
                <View className="ref-tier-td">
                  <Text className="ref-tier-td-text">
                    {tier.max_invites === -1
                      ? `邀请≥${tier.min_invites}人`
                      : `${tier.min_invites}人≤邀请<${tier.max_invites}人`}
                  </Text>
                </View>
                <View className="ref-tier-td">
                  <Text className="ref-tier-td-text">
                    {tier.base_reward > 0 ? `${tier.base_reward}元+` : ''}{tier.coins_reward}积分/人
                  </Text>
                  {tier.extra_reward && (
                    <Text className="ref-tier-td-extra">{tier.extra_reward}</Text>
                  )}
                </View>
                <View className="ref-tier-td">
                  <Text className="ref-tier-td-text">{tier.commission_rate * 100}%</Text>
                </View>
              </View>
            )
          })}
        </View>

        {/* 表格说明 */}
        <View className="ref-tier-table-footer">
          <View className="ref-tier-footer-item">
            <View className="ref-tier-footer-icon">
              <Clock size={12} color="#F59E0B" />
            </View>
            <Text className="ref-tier-footer-text">基础奖励：实时发放</Text>
          </View>
          <View className="ref-tier-footer-item">
            <View className="ref-tier-footer-icon">
              <Target size={12} color="#10B981" />
            </View>
            <Text className="ref-tier-footer-text">返佣触发：受邀用户充值会员或币</Text>
          </View>
          <View className="ref-tier-footer-item">
            <View className="ref-tier-footer-icon">
              <Zap size={12} color="#3B82F6" />
            </View>
            <Text className="ref-tier-footer-text">返佣发放：充值完成立即到账</Text>
          </View>
        </View>
      </View>

      {/* 最终活动奖励 */}
      <View className="ref-final-rewards-card">
        <View className="ref-section-title-wrap">
          <Crown size={16} color="#F59E0B" />
          <Text className="ref-section-title">最终活动奖励</Text>
        </View>
        <View className="ref-final-rewards-table">
          {/* 表格头部 */}
          <View className="ref-final-table-header">
            <View className="ref-final-th">
              <Text className="ref-final-th-text">排名</Text>
            </View>
            <View className="ref-final-th">
              <Text className="ref-final-th-text">现金奖励</Text>
            </View>
            <View className="ref-final-th">
              <Text className="ref-final-th-text">积分奖励</Text>
            </View>
            <View className="ref-final-th">
              <Text className="ref-final-th-text">身份标识</Text>
            </View>
            <View className="ref-final-th">
              <Text className="ref-final-th-text">最低门槛</Text>
            </View>
          </View>

          {/* 表格内容 */}
          <View className="ref-final-table-body">
            {/* 第一名 */}
            <View className="ref-final-row gold">
              <View className="ref-final-td">
                <Text className="ref-final-td-rank">第一名</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">500元+礼品</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">1000积分</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">首席星推官</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">≥100人</Text>
              </View>
            </View>

            {/* 第二名 */}
            <View className="ref-final-row silver">
              <View className="ref-final-td">
                <Text className="ref-final-td-rank">第二名</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">300元+礼品</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">500积分</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">荣誉推广大使</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">-</Text>
              </View>
            </View>

            {/* 第三名 */}
            <View className="ref-final-row bronze">
              <View className="ref-final-td">
                <Text className="ref-final-td-rank">第三名</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">100元+礼品</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">300积分</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">荣誉推广大使</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">-</Text>
              </View>
            </View>

            {/* 第四-第10名 */}
            <View className="ref-final-row">
              <View className="ref-final-td">
                <Text className="ref-final-td-rank">第4-10名</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">礼品1份</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">200积分</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">品牌品鉴官</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">≥50人</Text>
              </View>
            </View>

            {/* 第11-第20名 */}
            <View className="ref-final-row">
              <View className="ref-final-td">
                <Text className="ref-final-td-rank">第11-20名</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">-</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">100积分</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">品牌品鉴官</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">-</Text>
              </View>
            </View>

            {/* 第21-第50名 */}
            <View className="ref-final-row">
              <View className="ref-final-td">
                <Text className="ref-final-td-rank">第21-50名</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">-</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">50积分</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">品牌品鉴官</Text>
              </View>
              <View className="ref-final-td">
                <Text className="ref-final-td-text">-</Text>
              </View>
            </View>
          </View>

          {/* 表格说明 */}
          <View className="ref-final-table-footer">
            <View className="ref-final-footer-item">
              <Gift size={12} color="#F59E0B" />
              <Text className="ref-final-footer-text">礼品价值：298元/份</Text>
            </View>
            <View className="ref-final-footer-item">
              <Medal size={12} color="#8B5CF6" />
              <Text className="ref-final-footer-text">身份牌：专属身份标识徽章</Text>
            </View>
            <View className="ref-final-footer-item">
              <Clock size={12} color="#3B82F6" />
              <Text className="ref-final-footer-text">活动周期：30天，活动结束后统一发放</Text>
            </View>
          </View>
        </View>
      </View>

      {/* 活动规则 */}
      <View className="ref-rules-card">
        <View className="ref-section-title-wrap">
          <Info size={16} color="#7C3AED" />
          <Text className="ref-section-title">活动规则</Text>
        </View>
        <View className="ref-rules-list">

          <View className="ref-rule-item">
            <View className="ref-rule-icon" style={{ background: '#8B5CF6' }}>
              <Gift size={12} color="#fff" />
            </View>
            <Text className="ref-rule-text">新用户注册成功并创建分身即可获得基础奖励</Text>
          </View>
          <View className="ref-rule-item">
            <View className="ref-rule-icon" style={{ background: '#F59E0B' }}>
              <Coins size={12} color="#fff" />
            </View>
            <Text className="ref-rule-text">好友充值会员或币，您获得返佣奖励</Text>
          </View>
          <View className="ref-rule-item">
            <View className="ref-rule-icon" style={{ background: '#3B82F6' }}>
              <Zap size={12} color="#fff" />
            </View>
            <Text className="ref-rule-text">每人每日最多邀请10人，超出部分不计入奖励</Text>
          </View>
          <View className="ref-rule-item">
            <View className="ref-rule-icon" style={{ background: '#EF4444' }}>
              <Shield size={12} color="#fff" />
            </View>
            <Text className="ref-rule-text">本活动规则由【莫瑞娜】制定。在法律法规允许范围内，平台基于公平诚信原则对活动规则、异常行为认定、奖励发放享有解释、调整及最终决定权；对非法刷取、恶意套利、虚假邀请等违规行为，平台有权按规则取消资格、撤销并追回奖励</Text>
          </View>
        </View>
      </View>

      {/* 图片预览弹窗 */}
      {showImageModal && (
        <View className="ref-image-modal" onClick={() => setShowImageModal(false)}>
          <View className="ref-image-modal-content" onClick={(e) => e.stopPropagation()}>
            <View className="ref-image-modal-body">
              <Image
                className="ref-poster-image"
                src={posterImageUrl}
                mode="widthFix"
              />
            </View>
            <View className="ref-image-modal-footer">
              <View className="ref-modal-btn-cancel" onClick={() => setShowImageModal(false)}>
                <Text className="ref-modal-btn-text">取消</Text>
              </View>
              <View className="ref-modal-btn-download" onClick={handleDownloadImage}>
                <Download size={14} color="#fff" />
                <Text className="ref-modal-btn-text-white">保存图片</Text>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
