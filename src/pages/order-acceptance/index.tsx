import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  ArrowLeft, Check, X, Link, Image as ImageIcon, ChevronRight
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

const AVATAR_STATUS_COLORS: Record<string, { bg: string, text: string, border: string }> = {
  pending: { bg: '#fef3c7', text: '#d97706', border: '#f59e0b' },
  accepted: { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' },
  generating: { bg: '#dbeafe', text: '#2563eb', border: '#3b82f6' },
  publishing: { bg: '#ede9fe', text: '#7c3aed', border: '#8b5cf6' },
  published: { bg: '#dcfce7', text: '#16a34a', border: '#22c55e' },
  awaiting_acceptance: { bg: '#ede9fe', text: '#7c3aed', border: '#8b5cf6' },
  feedback_submitted: { bg: '#dcfce7', text: '#16a34a', border: '#22c55e' }
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
        // 只显示待验收的分身
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
          <View className="header-left" onClick={backToList}>
            <ArrowLeft size={24} color="#ffffff" />
          </View>
          <Text className="header-title">验收详情</Text>
          <View className="header-right" />
        </View>

        {/* 内容 */}
        <ScrollView scrollY className="content-scroll">
          {/* 分身信息 */}
          <View className="avatar-info-card">
            <View className="avatar-header">
              <Image
                src={selectedAvatar.avatarUrl || 'https://via.placeholder.com/48'}
                className="avatar-avatar"
                mode="aspectFill"
              />
              <View className="avatar-details">
                <Text className="avatar-name">{selectedAvatar.avatarName}</Text>
                <View
                  className="avatar-status"
                  style={{
                    backgroundColor: AVATAR_STATUS_COLORS[selectedAvatar.status]?.bg || '#f1f5f9',
                    borderColor: AVATAR_STATUS_COLORS[selectedAvatar.status]?.border || '#e2e8f0'
                  }}
                >
                  <Text style={{
                    color: AVATAR_STATUS_COLORS[selectedAvatar.status]?.text || '#64748b'
                  }}
                  >
                    {AVATAR_STATUS_LABELS[selectedAvatar.status] || '未知'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 发布提交 */}
          {selectedAvatar.publishFeedback && (
            <View className="feedback-section">
              <Text className="section-title">发布提交</Text>

              {Object.entries(selectedAvatar.publishFeedback).map(([platform, feedback]: [string, any]) => (
                <View key={platform} className="feedback-card">
                  <View className="feedback-header">
                    <Text className="feedback-platform">{platform === 'wechat_mp' ? '微信公众号' : platform}</Text>
                  </View>

                  {/* 链接 */}
                  {feedback.link && (
                    <View className="feedback-item">
                      <Link size={16} color="#6366f1" />
                      <View className="feedback-link">
                        <Text className="feedback-link-label">发布链接</Text>
                        <Text className="feedback-link-value">{feedback.link}</Text>
                      </View>
                    </View>
                  )}

                  {/* 截图 */}
                  {feedback.image && (
                    <View className="feedback-item">
                      <ImageIcon size={16} color="#6366f1" />
                      <View className="feedback-image">
                        <Text className="feedback-image-label">发布截图</Text>
                        <Image
                          src={feedback.image}
                          className="feedback-image-img"
                          mode="widthFix"
                        />
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
            className="action-btn reject-btn"
            onClick={() => setShowReject(true)}
          >
            <X size={18} color="#ef4444" />
            <Text>驳回修改</Text>
          </Button>
          <Button
            className="action-btn approve-btn"
            onClick={() => setShowApprove(true)}
          >
            <Check size={18} color="#ffffff" />
            <Text>验收通过</Text>
          </Button>
        </View>

        {/* 驳回弹窗 */}
        {showReject && (
          <View className="modal-overlay" onClick={() => setShowReject(false)}>
            <View className="modal-content" onClick={(e) => e.stopPropagation()}>
              <Text className="modal-title">驳回原因</Text>
              <Textarea
                className="modal-textarea"
                placeholder="请输入驳回原因..."
                value={rejectReason}
                onInput={(e) => setRejectReason(e.detail.value)}
                maxlength={500}
              />
              <View className="modal-actions">
                <Button className="modal-btn-cancel" onClick={() => setShowReject(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="modal-btn-confirm" onClick={handleReject}>
                  <Text>确认驳回</Text>
                </Button>
              </View>
            </View>
          </View>
        )}

        {/* 验收通过弹窗 */}
        {showApprove && (
          <View className="modal-overlay" onClick={() => setShowApprove(false)}>
            <View className="modal-content" onClick={(e) => e.stopPropagation()}>
              <Text className="modal-title">确认验收通过？</Text>
              <Text className="modal-desc">验收通过后将无法撤回</Text>
              <View className="modal-actions">
                <Button className="modal-btn-cancel" onClick={() => setShowApprove(false)}>
                  <Text>取消</Text>
                </Button>
                <Button className="modal-btn-confirm" onClick={handleApprove}>
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
        <View className="header-left" onClick={() => navigateBack()}>
          <ArrowLeft size={24} color="#ffffff" />
        </View>
        <Text className="header-title">验收中</Text>
        <View className="header-right" />
      </View>

      {/* 内容 */}
      <ScrollView scrollY className="content-scroll">
        {avatars.length > 0 ? (
          <View className="avatar-list">
            {avatars.map((avatar) => (
              <View
                key={avatar.avatarId}
                className="avatar-card"
                onClick={() => openAvatarDetail(avatar)}
              >
                <View className="avatar-card-header">
                  <Image
                    src={avatar.avatarUrl || 'https://via.placeholder.com/48'}
                    className="avatar-card-avatar"
                    mode="aspectFill"
                  />
                  <View className="avatar-card-info">
                    <View className="avatar-name-row">
                      <Text className="avatar-card-name">{avatar.avatarName}</Text>
                      <View
                        className="avatar-card-status"
                        style={{
                          backgroundColor: AVATAR_STATUS_COLORS[avatar.status]?.bg || '#f1f5f9',
                          borderColor: AVATAR_STATUS_COLORS[avatar.status]?.border || '#e2e8f0'
                        }}
                      >
                        <Text style={{
                          color: AVATAR_STATUS_COLORS[avatar.status]?.text || '#64748b'
                        }}
                        >
                          {AVATAR_STATUS_LABELS[avatar.status] || '未知'}
                        </Text>
                      </View>
                    </View>
                    <Text className="avatar-card-hint">
                      {avatar.publishFeedback ? '已提交发布内容' : '等待提交发布内容'}
                    </Text>
                  </View>
                  <ChevronRight size={20} color="#94a3b8" />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="empty-state">
            <Check size={64} color="#22c55e" />
            <Text className="empty-title">所有分身已验收完成</Text>
            <Text className="empty-desc">可以返回订单详情页查看</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
