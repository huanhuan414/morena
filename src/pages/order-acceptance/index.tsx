import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  ArrowLeft, Check, CircleAlert, Link2, Image as ImageIcon, ExternalLink,
  ChevronRight, TrendingUp
} from 'lucide-react-taro'
import './index.css'

const AVATAR_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  accepted: '已接单',
  generating: '生成中',
  publishing: '发布中',
  published: '已发布',
  awaiting_acceptance: '待验收',
  feedback_submitted: '已提交'
}

/**
 * 格式化数字，将大数字转换为更易读的形式
 * 例如：12345 -> 1.2万
 */
function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0'
  if (num >= 10000) {
    return (num / 10000).toFixed(1) + '万'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return num.toString()
}

interface AvatarStat {
  avatarId: string
  avatarName: string
  avatarUrl: string
  status: string
  publishFeedback: any
  orderId: string
}

export default function OrderAcceptance() {
  const router = useRouter()
  const { orderId } = router.params
  const [avatars, setAvatars] = useState<AvatarStat[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarStat | null>(null)
  const [showApprove, setShowApprove] = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  useLoad(() => {
    if (orderId) {
      fetchAvatars()
    }
  })

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({
        url: `/api/order/${orderId}`
      })

      if (res.data?.code === 200 && res.data.data?.summary_stats?.avatarStats) {
        const pendingAvatars = res.data.data.summary_stats.avatarStats.filter(
          (avatar: AvatarStat) => avatar.status === 'awaiting_acceptance' || avatar.status === 'feedback_submitted'
        )
        setAvatars(pendingAvatars.map((a: AvatarStat) => ({ ...a, orderId })))
      }
    } catch (error) {
      console.error('获取分身列表失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    if (!selectedAvatar) return

    try {
      const res = await Network.request({
        url: `/api/order/${orderId}/avatar/${selectedAvatar.avatarId}/approve`,
        method: 'PUT'
      })

      if (res.data?.code === 200) {
        showToast({ title: '已验收通过', icon: 'success' })
        setShowApprove(false)
        setSelectedAvatar(null)
        fetchAvatars()
      }
    } catch (error) {
      console.error('验收失败:', error)
      showToast({ title: '验收失败', icon: 'none' })
    }
  }

  const handleReject = async () => {
    if (!selectedAvatar || !rejectReason.trim()) {
      showToast({ title: '请输入驳回原因', icon: 'none' })
      return
    }

    try {
      const res = await Network.request({
        url: `/api/order/${orderId}/avatar/${selectedAvatar.avatarId}/reject`,
        method: 'PUT',
        data: { reason: rejectReason }
      })

      if (res.data?.code === 200) {
        showToast({ title: '已驳回', icon: 'success' })
        setShowReject(false)
        setRejectReason('')
        setSelectedAvatar(null)
        fetchAvatars()
      }
    } catch (error) {
      console.error('驳回失败:', error)
      showToast({ title: '驳回失败', icon: 'none' })
    }
  }

  const openAvatarDetail = (avatar: AvatarStat) => {
    setSelectedAvatar(avatar)
  }

  const backToList = () => {
    setSelectedAvatar(null)
  }

  if (loading) {
    return (
      <View className="acceptance-page">
        <View className="loading-container">
          <View className="loading-spinner" />
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (selectedAvatar) {
    return (
      <View className="acceptance-page">
        {/* 头部 */}
        <View className="page-header">
          <View className="header-btn" onClick={backToList}>
            <ArrowLeft size={22} color="#1e293b" />
          </View>
          <Text className="header-title">验收详情</Text>
          <View className="header-btn" />
        </View>

        {/* 内容 */}
        <ScrollView scrollY className="content-scroll">
          {/* 分身信息卡片 */}
          <View className="avatar-header-card">
            <Image
              src={selectedAvatar.avatarUrl || 'https://via.placeholder.com/64'}
              className="avatar-avatar-large"
              mode="aspectFill"
            />
            <View className="avatar-info-large">
              <Text className="avatar-name-large">{selectedAvatar.avatarName}</Text>
              <View className="avatar-status-badge">
                <Check size={14} color="#6366f1" />
                <Text className="avatar-status-text">
                  {AVATAR_STATUS_LABELS[selectedAvatar.status] || '待验收'}
                </Text>
              </View>
            </View>
          </View>

          {/* 发布提交 */}
          {selectedAvatar.publishFeedback && (
            <View className="content-section">
              <Text className="section-title">发布提交</Text>

              {Object.entries(selectedAvatar.publishFeedback).map(([platform, feedback]: [string, any]) => (
                <View key={platform} className="platform-card">
                  <View className="platform-header">
                    <View className="platform-icon">
                      <Link2 size={20} color="#6366f1" />
                    </View>
                    <Text className="platform-name">
                      {platform === 'wechat_mp' ? '微信公众号' : platform}
                    </Text>
                  </View>

                  {/* 链接 */}
                  {feedback.link && (
                    <View className="link-item">
                      <View className="link-icon">
                        <ExternalLink size={16} color="#6366f1" />
                      </View>
                      <View className="link-content">
                        <Text className="link-label">发布链接</Text>
                        <Text className="link-url">{feedback.link}</Text>
                      </View>
                    </View>
                  )}

                  {/* 截图 */}
                  {feedback.image && (
                    <View className="image-item">
                      <View className="image-icon">
                        <ImageIcon size={16} color="#6366f1" />
                      </View>
                      <View className="image-content">
                        <Text className="image-label">发布截图</Text>
                        <Image
                          src={feedback.image}
                          className="screenshot-image"
                          mode="widthFix"
                        />
                      </View>
                    </View>
                  )}

                  {/* 数据统计 */}
                  {(feedback.views !== undefined || feedback.likes !== undefined || feedback.comments !== undefined || feedback.shares !== undefined) && (
                    <View className="stats-item">
                      <View className="stats-icon">
                        <TrendingUp size={16} color="#6366f1" />
                      </View>
                      <View className="stats-content">
                        <Text className="stats-label">数据统计</Text>
                        <View className="stats-row">
                          {feedback.views !== undefined && (
                            <View className="stat-box">
                              <Text className="stat-value">{formatNumber(feedback.views)}</Text>
                              <Text className="stat-label">浏览</Text>
                            </View>
                          )}
                          {feedback.likes !== undefined && (
                            <View className="stat-box">
                              <Text className="stat-value">{formatNumber(feedback.likes)}</Text>
                              <Text className="stat-label">点赞</Text>
                            </View>
                          )}
                          {feedback.comments !== undefined && (
                            <View className="stat-box">
                              <Text className="stat-value">{formatNumber(feedback.comments)}</Text>
                              <Text className="stat-label">评论</Text>
                            </View>
                          )}
                          {feedback.shares !== undefined && (
                            <View className="stat-box">
                              <Text className="stat-value">{formatNumber(feedback.shares)}</Text>
                              <Text className="stat-label">分享</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* 底部操作 */}
        <View className="bottom-actions">
          <Button
            variant="outline"
            className="reject-btn-modern"
            onClick={() => setShowReject(true)}
          >
            <CircleAlert size={18} color="#ef4444" />
            <Text>驳回</Text>
          </Button>
          <Button
            className="approve-btn-modern"
            onClick={() => setShowApprove(true)}
          >
            <Check size={18} color="#ffffff" />
            <Text>验收</Text>
          </Button>
        </View>

        {/* 驳回弹窗 */}
        {showReject && (
          <View className="modal-backdrop" onClick={() => setShowReject(false)}>
            <View className="modal-container" onClick={(e) => e.stopPropagation()}>
              <View className="modal-icon-wrapper">
                <CircleAlert size={36} color="#ef4444" />
              </View>
              <Text className="modal-title-modern">驳回修改</Text>
              <Text className="modal-subtitle">请输入驳回原因</Text>
              <Textarea
                className="modal-textarea-modern"
                placeholder="请详细描述问题，方便分身修改..."
                value={rejectReason}
                onInput={(e) => setRejectReason(e.detail.value)}
                maxlength={500}
              />
              <View className="modal-footer">
                <Button
                  variant="outline"
                  className="modal-btn-cancel"
                  onClick={() => setShowReject(false)}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="modal-btn-confirm"
                  onClick={handleReject}
                >
                  <Text>确认驳回</Text>
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* 验收通过弹窗 */}
        {showApprove && (
          <View className="modal-backdrop" onClick={() => setShowApprove(false)}>
            <View className="modal-container" onClick={(e) => e.stopPropagation()}>
              <View className="modal-icon-wrapper modal-icon-success">
                <Check size={36} color="#22c55e" />
              </View>
              <Text className="modal-title-modern">确认验收通过？</Text>
              <Text className="modal-subtitle">验收通过后将无法撤回，请仔细检查</Text>
              <View className="modal-footer">
                <Button
                  variant="outline"
                  className="modal-btn-cancel"
                  onClick={() => setShowApprove(false)}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  className="modal-btn-confirm-success"
                  onClick={handleApprove}
                >
                  <Text>确认通过</Text>
                </Button>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View className="acceptance-page">
      {/* 头部 */}
      <View className="page-header">
        <View className="header-btn" onClick={() => navigateBack()}>
          <ArrowLeft size={22} color="#1e293b" />
        </View>
        <Text className="header-title">验收中</Text>
        <View className="header-btn" />
      </View>

      {/* 进度指示 */}
      <View className="progress-section">
        <View className="progress-bar">
          <View
            className="progress-fill"
            style={{ width: `${Math.min((avatars.length / (avatars.length + 0.1)) * 100, 100)}%` }}
          />
        </View>
        <Text className="progress-text">
          待验收 {avatars.length} 个分身
        </Text>
      </View>

      {/* 内容 */}
      <ScrollView scrollY className="content-scroll-list">
        {avatars.length > 0 ? (
          <View className="avatar-list-modern">
            {avatars.map((avatar, index) => (
              <View
                key={avatar.avatarId}
                className="avatar-card-modern"
                onClick={() => openAvatarDetail(avatar)}
              >
                <View className="avatar-card-left">
                  <View className="avatar-number">{index + 1}</View>
                  <Image
                    src={avatar.avatarUrl || 'https://via.placeholder.com/48'}
                    className="avatar-card-avatar"
                    mode="aspectFill"
                  />
                  <View className="avatar-card-info">
                    <Text className="avatar-card-name">{avatar.avatarName}</Text>
                    <Text className="avatar-card-hint">
                      {avatar.publishFeedback ? '已提交发布内容' : '等待提交'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={20} color="#cbd5e1" />
              </View>
            ))}
          </View>
        ) : (
          <View className="empty-state-modern">
            <View className="empty-icon">
              <Check size={64} color="#22c55e" />
            </View>
            <Text className="empty-title">全部完成</Text>
            <Text className="empty-desc">所有分身已验收完成</Text>
            <Button
              className="empty-btn"
              onClick={() => navigateBack()}
            >
              <Text>返回订单详情</Text>
            </Button>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
