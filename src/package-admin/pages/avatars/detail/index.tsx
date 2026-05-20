import { useEffect, useMemo, useState } from 'react'
import { Image, ScrollView, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ArrowLeft, MessageSquare, User, Ban } from 'lucide-react-taro'
import * as Network from '@/network'
import './index.css'

interface AvatarDetail {
  id: string
  user_id: string
  name: string
  avatar_url?: string
  description?: string
  status?: string
  created_at?: string
  createdAt?: string
  hosting_enabled?: number | boolean
  hosting_price?: number | string
  total_orders?: number | string
  completion_rate?: number | string
  user_phone?: string
  user_nickname?: string
  conversations_count?: number | string
}

export default function AdminAvatarDetail() {
  const [avatar, setAvatar] = useState<AvatarDetail | null>(null)

  const avatarId = useMemo(() => {
    const { id } = Taro.getCurrentInstance().router?.params || {}
    return String(id || '').trim()
  }, [])

  const toNumber = (value: any) => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
  }

  const mapStatusFromDb = (status: any): 'active' | 'pending_review' | 'banned' => {
    if (status === 'active') return 'active'
    if (status === 'training') return 'pending_review'
    return 'banned'
  }

  const formatDateTime = (value: any) => {
    const date = value ? new Date(value) : null
    if (!date || Number.isNaN(date.getTime())) return '-'
    return date.toLocaleString('zh-CN')
  }

  const displayStatus = useMemo(() => mapStatusFromDb(avatar?.status), [avatar?.status])

  useEffect(() => {
    if (!avatarId) return
    fetchDetail(avatarId)
  }, [avatarId])

  const fetchDetail = async (id: string) => {
    try {
      const res = await Network.request({ url: `/api/admin/avatars/${id}` })
      if (res.data.code === 200) {
        setAvatar(res.data.data || null)
      }
    } catch (err) {
      console.error('获取分身详情失败:', err)
    }
  }

  const handleToggleStatus = async () => {
    if (!avatar) return
    const nextStatus = avatar.status === 'active' ? 'inactive' : 'active'
    const action = avatar.status === 'active' ? '下架' : '上架'
    Taro.showModal({
      title: `确认${action}`,
      content: `确定要${action}该分身吗？`,
      success: async (res) => {
        if (!res.confirm) return
        try {
          const result = await Network.request({
            url: '/api/admin/avatars/toggle-status',
            method: 'POST',
            data: { avatar_id: avatar.id, status: nextStatus }
          })
          if (result.data.code === 200) {
            Taro.showToast({ title: `${action}成功`, icon: 'success' })
            fetchDetail(avatar.id)
          }
        } catch {
          Taro.showToast({ title: '操作失败', icon: 'none' })
        }
      }
    })
  }

  const handleGoBack = () => {
    Taro.navigateBack()
  }

  const handleViewChats = () => {
    if (!avatar) return
    Taro.navigateTo({ url: `/package-admin/pages/avatars/chats/index?avatar_id=${avatar.id}` })
  }

  const handleViewUser = () => {
    if (!avatar?.user_id) return
    Taro.navigateTo({ url: `/package-admin/pages/users/detail/index?id=${avatar.user_id}` })
  }

  if (!avatar) {
    return (
      <View className="avatar-detail-page">
        <Text className="loading-text">加载中...</Text>
      </View>
    )
  }

  const createdAt = avatar.created_at || avatar.createdAt

  return (
    <View className="avatar-detail-page">
      <View className="detail-header">
        <View className="back-btn" onClick={handleGoBack}>
          <ArrowLeft size={24} color="#374151" />
        </View>
        <Text className="detail-title">分身详情</Text>
        <View className="header-placeholder" />
      </View>

      <ScrollView scrollY>
        <View className="avatar-card">
          <View className="avatar-basic">
            {avatar.avatar_url ? (
              <Image src={avatar.avatar_url} className="avatar-img-lg" mode="aspectFill" />
            ) : (
              <View className="avatar-placeholder-lg">
                <Text className="avatar-text-lg">{avatar.name?.[0] || 'A'}</Text>
              </View>
            )}
            <View className="avatar-meta">
              <Text className="avatar-name-lg">{avatar.name || '-'}</Text>
              <Text className="avatar-sub">
                {avatar.user_nickname ? `${avatar.user_nickname} / ` : ''}
                {avatar.user_phone || '-'}
              </Text>
              <View className={`status-tag ${displayStatus}`}>
                <Text className="status-tag-text">
                  {displayStatus === 'active' ? '正常' : displayStatus === 'pending_review' ? '待审核' : '已下架'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View className="info-section">
          <Text className="section-title">关键信息</Text>
          <View className="info-grid">
            <View className="info-item">
              <Text className="info-label">价格</Text>
              <Text className="info-value highlight">¥{toNumber(avatar.hosting_price).toFixed(2)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">公开</Text>
              <Text className="info-value">{avatar.hosting_enabled ? '是' : '否'}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">订单数</Text>
              <Text className="info-value">{toNumber(avatar.total_orders)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">评分/完成率</Text>
              <Text className="info-value">{toNumber(avatar.completion_rate)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">对话数</Text>
              <Text className="info-value">{toNumber(avatar.conversations_count)}</Text>
            </View>
            <View className="info-item">
              <Text className="info-label">创建时间</Text>
              <Text className="info-value">{formatDateTime(createdAt)}</Text>
            </View>
          </View>
        </View>

        <View className="info-section">
          <Text className="section-title">描述</Text>
          <Text className="desc-text">{String(avatar.description || '-')}</Text>
        </View>

        <View className="action-bar">
          <View className="action-btn primary" onClick={handleViewChats}>
            <MessageSquare size={18} color="#fff" />
            <Text className="action-btn-text">聊天记录</Text>
          </View>
          <View className="action-btn" onClick={handleViewUser}>
            <User size={18} color="#374151" />
            <Text className="action-btn-text">所属用户</Text>
          </View>
          <View
            className={`action-btn ${displayStatus === 'active' ? 'danger' : 'success'}`}
            onClick={handleToggleStatus}
          >
            <Ban size={18} color="#fff" />
            <Text className="action-btn-text">{displayStatus === 'active' ? '下架' : '上架'}</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  )
}

