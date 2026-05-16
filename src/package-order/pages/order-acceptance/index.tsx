import Taro, { useLoad, useRouter, navigateBack, showToast, previewImage } from '@tarojs/taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import { useState } from 'react'
import { View, Text, ScrollView, Image, Input, Video as TaroVideo } from '@tarojs/components'
import * as Network from '@/network'
import {
  ArrowLeft, Check, CircleAlert, Image as ImageIcon, ExternalLink,
  ChevronRight, TrendingUp, CircleCheckBig, Video, FileText
} from 'lucide-react-taro'
import '../order-detail/index.css'

const isH5 = Taro.getEnv() === Taro.ENV_TYPE.WEB

const AVATAR_STATUS_LABELS: Record<string, string> = {
  pending: '待确认',
  accepted: '已接单',
  generating: '生成中',
  publishing: '发布中',
  published: '已发布',
  awaiting_acceptance: '待验收',
  feedback_submitted: '已提交'
}

function formatNumber(num: number): string {
  if (num === undefined || num === null) return '0'
  if (num >= 10000) return (num / 10000).toFixed(1) + '万'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
  return num.toString()
}

interface AvatarStat {
  requestId?: string
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
  const [generatedContent, setGeneratedContent] = useState<{ content?: string; images?: string[]; videos?: string[] } | null>(null)
  const statusBarHeight = getStatusBarHeight()

  useLoad(() => {
    if (orderId) fetchAvatars()
  })

  const fetchAvatars = async () => {
    try {
      const res = await Network.request({ url: `/api/order/${orderId}` })
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

  const handleSelectAvatar = async (avatar: AvatarStat) => {
    setSelectedAvatar(avatar)
    setGeneratedContent(null)
    if (avatar.requestId) {
      try {
        const res = await Network.request({ url: `/api/content-generation/content/${avatar.requestId}` })
        console.log('验收页获取生成内容:', res.data)
        if (res.data?.code === 200 && res.data.data) {
          const data = res.data.data
          setGeneratedContent({
            content: data.content || data.textContent || '',
            images: Array.isArray(data.images) ? data.images : [],
            videos: Array.isArray(data.videos) ? data.videos : (Array.isArray(data.videoUrl) ? data.videoUrl : (data.videoUrl ? [data.videoUrl] : []))
          })
        }
      } catch (error) {
        console.error('获取生成内容失败:', error)
      }
    }
  }

  const handleApprove = async () => {
    if (!selectedAvatar) return
    try {
      const requestId = selectedAvatar.requestId
      if (!requestId) {
        showToast({ title: '缺少请求ID，无法验收', icon: 'none' })
        return
      }
      const res = await Network.request({
        url: `/api/order-processing/accept/${requestId}`,
        method: 'PUT'
      })
      if (res.data?.code === 200) {
        const rewardAmount = res.data?.data?.rewardAmount
        const message = rewardAmount
          ? `验收通过！分身已获得 ${rewardAmount.toFixed(2)} 元奖励`
          : '已验收通过'
        showToast({ title: message, icon: 'success', duration: 2500 })
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
      const requestId = selectedAvatar.requestId
      if (!requestId) {
        showToast({ title: '缺少请求ID，无法驳回', icon: 'none' })
        return
      }
      const res = await Network.request({
        url: `/api/order-processing/revision/${requestId}`,
        method: 'POST',
        data: { feedback: { rejectReason: rejectReason.trim(), status: 'revision_requested' } }
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

  const handleLinkClick = (url: string) => {
    if (!url) {
      showToast({ title: '链接为空', icon: 'none' })
      return
    }
    try {
      const isFullUrl = url.startsWith('http://') || url.startsWith('https://')
      if (!isFullUrl) {
        showToast({ title: '链接格式不正确', icon: 'none' })
        return
      }
      if (isH5) {
        window.open(url, '_blank')
      } else {
        Taro.navigateTo({ url: `/pages/webview/index?url=${encodeURIComponent(url)}` })
      }
    } catch (error) {
      showToast({ title: '打开链接失败', icon: 'none' })
    }
  }

  const handleImagePreview = (imageUrl: string) => {
    if (!imageUrl) return
    try {
      previewImage({ urls: [imageUrl], current: imageUrl })
    } catch (error) {
      showToast({ title: '预览图片失败', icon: 'none' })
    }
  }

  if (loading) {
    return (
      <View className="od-page od-loading">
        <Text className="block od-loading-text">加载中...</Text>
      </View>
    )
  }

  if (selectedAvatar) {
    return (
      <View className="od-page">
        {/* 头部 */}
        <View className="od-header">
          <View className="od-header-deco1" />
          <View className="od-header-deco2" />
          <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
            <View className="od-back-btn" onClick={() => { setSelectedAvatar(null); setGeneratedContent(null) }}>
              <ArrowLeft size={18} color="#fff" />
            </View>
            <View className="od-header-center">
              <Text className="block od-header-title">验收详情</Text>
            </View>
            <View className="od-header-right" />
          </View>
          <View className="od-status-section">
            <View className="od-status-badge" style={{ backgroundColor: '#EEF2FF' }}>
              <Text className="block od-status-badge-text" style={{ color: '#6366F1' }}>待验收</Text>
            </View>
            <Text className="block od-status-desc">请检查分身提交的内容并确认验收</Text>
          </View>
        </View>

        {/* 内容 */}
        <ScrollView scrollY className="od-body">
          {/* 分身信息卡 */}
          <View className="od-card">
            <View className="od-avatar-header">
              <Image src={selectedAvatar.avatarUrl || ''} className="od-avatar-large" mode="aspectFill" />
              <View className="od-avatar-info">
                <Text className="block od-avatar-name">{selectedAvatar.avatarName}</Text>
                <View className="od-status-badge" style={{ backgroundColor: '#EEF2FF' }}>
                  <Check size={12} color="#6366F1" />
                  <Text className="block od-status-badge-text" style={{ color: '#6366F1', fontSize: '12px' }}>
                    {AVATAR_STATUS_LABELS[selectedAvatar.status] || '待验收'}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* 生成内容 */}
          {generatedContent && (
            <View className="od-card">
              <View className="od-stats-header" style={{ marginBottom: 12 }}>
                <FileText size={16} color="#6366F1" />
                <Text className="block od-stats-title">分身创作内容</Text>
              </View>

              {/* 文案内容 */}
              {generatedContent.content && (
                <View style={{ marginBottom: 12 }}>
                  <Text className="block" style={{ fontSize: '13px', color: '#6B7280', marginBottom: 4 }}>文案</Text>
                  <View style={{ backgroundColor: '#F9FAFB', borderRadius: 8, padding: 12 }}>
                    <Text className="block" style={{ fontSize: '14px', color: '#1F2937', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {generatedContent.content}
                    </Text>
                  </View>
                </View>
              )}

              {/* 图片内容 */}
              {generatedContent.images && generatedContent.images.length > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <ImageIcon size={14} color="#6366F1" />
                    <Text className="block" style={{ fontSize: '13px', color: '#6B7280', marginLeft: 4 }}>配图 ({generatedContent.images.length})</Text>
                  </View>
                  <View className="od-images-grid">
                    {generatedContent.images.map((img: string, idx: number) => (
                      <Image
                        key={idx}
                        src={img}
                        className="od-preview-image"
                        mode="aspectFill"
                        onClick={() => handleImagePreview(img)}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* 视频内容 */}
              {generatedContent.videos && generatedContent.videos.length > 0 && (
                <View>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Video size={14} color="#6366F1" />
                    <Text className="block" style={{ fontSize: '13px', color: '#6B7280', marginLeft: 4 }}>视频 ({generatedContent.videos.length})</Text>
                  </View>
                  {generatedContent.videos.map((url: string, idx: number) => (
                    <View key={idx} style={{ marginBottom: 8, borderRadius: 8, overflow: 'hidden' }}>
                      <TaroVideo src={url} style={{ width: '100%', height: '180px' }} autoplay={false} controls />
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* 发布提交 */}
          {selectedAvatar.publishFeedback && (
            <>
              {/* 数据统计 */}
              {Object.entries(selectedAvatar.publishFeedback).map(([platform, feedback]: [string, any]) => (
                <View key={platform}>
                  {(feedback.views !== undefined || feedback.likes !== undefined || feedback.comments !== undefined || feedback.shares !== undefined) && (
                    <View className="od-card od-stats-card">
                      <View className="od-stats-header">
                        <TrendingUp size={16} color="#6366F1" />
                        <Text className="block od-stats-title">数据统计</Text>
                      </View>
                      <View className="od-stats-row">
                        {feedback.views !== undefined && (
                          <View className="od-stat-item">
                            <Text className="block od-stat-value">{formatNumber(feedback.views)}</Text>
                            <Text className="block od-stat-label">浏览</Text>
                          </View>
                        )}
                        {feedback.likes !== undefined && (
                          <View className="od-stat-item">
                            <Text className="block od-stat-value">{formatNumber(feedback.likes)}</Text>
                            <Text className="block od-stat-label">点赞</Text>
                          </View>
                        )}
                        {feedback.comments !== undefined && (
                          <View className="od-stat-item">
                            <Text className="block od-stat-value">{formatNumber(feedback.comments)}</Text>
                            <Text className="block od-stat-label">评论</Text>
                          </View>
                        )}
                        {feedback.shares !== undefined && (
                          <View className="od-stat-item">
                            <Text className="block od-stat-value">{formatNumber(feedback.shares)}</Text>
                            <Text className="block od-stat-label">分享</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              ))}

              {/* 链接和截图 */}
              {Object.entries(selectedAvatar.publishFeedback).map(([platform, feedback]: [string, any]) => (
                <View key={platform} className="od-card">
                  <Text className="block od-section-title">
                    {platform === 'xiaohongshu' ? '小红书' : platform === 'wechat_mp' ? '微信公众号' : platform}
                  </Text>
                  
                  {feedback.link && (
                    <View className="od-link-item" onClick={() => handleLinkClick(feedback.link)}>
                      <View className="od-link-icon">
                        <ExternalLink size={14} color="#6366F1" />
                      </View>
                      <View className="od-link-content">
                        <Text className="block od-link-label">发布链接</Text>
                        <Text className="block od-link-url">{feedback.link}</Text>
                      </View>
                      <ChevronRight size={16} color="#9CA3AF" />
                    </View>
                  )}

                  {feedback.images && Array.isArray(feedback.images) && feedback.images.length > 0 && (
                    <View className="od-images-section">
                      <View className="od-images-header">
                        <ImageIcon size={14} color="#6366F1" />
                        <Text className="block od-images-label">发布截图</Text>
                      </View>
                      <View className="od-images-grid">
                        {feedback.images.map((img: string, idx: number) => (
                          <Image
                            key={idx}
                            src={img}
                            className="od-preview-image"
                            mode="aspectFill"
                            onClick={() => handleImagePreview(img)}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {feedback.image && !feedback.images && (
                    <View className="od-images-section">
                      <View className="od-images-header">
                        <ImageIcon size={14} color="#6366F1" />
                        <Text className="block od-images-label">发布截图</Text>
                      </View>
                      <View className="od-images-grid">
                        <Image
                          src={feedback.image}
                          className="od-preview-image"
                          mode="aspectFill"
                          onClick={() => handleImagePreview(feedback.image)}
                        />
                      </View>
                    </View>
                  )}
                </View>
              ))}
            </>
          )}
        </ScrollView>

        {/* 底部操作 */}
        <View className="od-actions">
          <View className="od-action-btn od-action-danger" onClick={() => setShowReject(true)}>
            <CircleAlert size={16} color="#EF4444" />
            <Text className="block od-action-text" style={{ color: '#EF4444' }}>驳回</Text>
          </View>
          <View className="od-action-btn od-action-primary" onClick={() => setShowApprove(true)}>
            <CircleCheckBig size={16} color="#fff" />
            <Text className="block od-action-text" style={{ color: '#fff' }}>验收通过</Text>
          </View>
        </View>

        {/* 驳回弹窗 */}
        {showReject && (
          <View className="od-modal-overlay" onClick={() => setShowReject(false)}>
            <View className="od-modal" onClick={(e) => e.stopPropagation()}>
              <View className="od-modal-icon" style={{ backgroundColor: '#FEE2E2' }}>
                <CircleAlert size={24} color="#EF4444" />
              </View>
              <Text className="block od-modal-title">驳回修改</Text>
              <Text className="block od-modal-desc">请输入驳回原因，方便分身修改</Text>
              <View className="od-modal-input-wrap">
                <Input className="od-modal-input" placeholder="请详细描述问题..." value={rejectReason} onInput={(e: any) => setRejectReason(e.detail.value)} />
              </View>
              <View className="od-modal-actions">
                <View className="od-modal-btn od-modal-btn-cancel" onClick={() => setShowReject(false)}>
                  <Text className="block">取消</Text>
                </View>
                <View className="od-modal-btn od-modal-btn-danger" onClick={handleReject}>
                  <Text className="block" style={{ color: '#fff' }}>确认驳回</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* 验收通过弹窗 */}
        {showApprove && (
          <View className="od-modal-overlay" onClick={() => setShowApprove(false)}>
            <View className="od-modal" onClick={(e) => e.stopPropagation()}>
              <View className="od-modal-icon" style={{ backgroundColor: '#D1FAE5' }}>
                <Check size={24} color="#10B981" />
              </View>
              <Text className="block od-modal-title">确认验收通过？</Text>
              <Text className="block od-modal-desc">验收通过后将无法撤回，请仔细检查</Text>
              <View className="od-modal-actions">
                <View className="od-modal-btn od-modal-btn-cancel" onClick={() => setShowApprove(false)}>
                  <Text className="block">取消</Text>
                </View>
                <View className="od-modal-btn od-modal-btn-primary" onClick={handleApprove}>
                  <Text className="block" style={{ color: '#fff' }}>确认通过</Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </View>
    )
  }

  return (
    <View className="od-page">
      {/* 头部 */}
      <View className="od-header">
        <View className="od-header-deco1" />
        <View className="od-header-deco2" />
        <View className="od-header-bar" style={{ paddingTop: `${statusBarHeight + 12}px` }}>
          <View className="od-back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={18} color="#fff" />
          </View>
          <View className="od-header-center">
            <Text className="block od-header-title">验收中</Text>
          </View>
          <View className="od-header-right" />
        </View>
        <View className="od-status-section">
          <View className="od-status-badge" style={{ backgroundColor: '#FEF3C7' }}>
            <Text className="block od-status-badge-text" style={{ color: '#F59E0B' }}>待验收</Text>
          </View>
          <Text className="block od-status-desc">共 {avatars.length} 个分身待验收</Text>
        </View>
      </View>

      {/* 内容 */}
      <ScrollView scrollY className="od-body">
        {avatars.length > 0 ? (
          <View className="od-card">
            <Text className="block od-section-title">待验收分身</Text>
            {avatars.map((avatar, index) => (
              <View key={avatar.avatarId} className="od-avatar-item" onClick={() => handleSelectAvatar(avatar)}>
                <View className="od-avatar-left">
                  <View className="od-avatar-num">{index + 1}</View>
                  <Image src={avatar.avatarUrl || ''} className="od-avatar-thumb" mode="aspectFill" />
                  <View className="od-avatar-text">
                    <Text className="block od-avatar-name">{avatar.avatarName}</Text>
                    <Text className="block od-avatar-hint">
                      {avatar.publishFeedback ? '已提交发布内容' : '等待提交'}
                    </Text>
                  </View>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </View>
            ))}
          </View>
        ) : (
          <View className="od-card od-empty-card">
            <View className="od-empty-icon">
              <CircleCheckBig size={48} color="#10B981" />
            </View>
            <Text className="block od-empty-title">全部完成</Text>
            <Text className="block od-empty-desc">所有分身已验收完成</Text>
            <View className="od-action-btn od-action-primary" onClick={() => navigateBack()}>
              <Text className="block od-action-text" style={{ color: '#fff' }}>返回订单详情</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
