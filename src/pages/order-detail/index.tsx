import { View, Text, ScrollView, Image } from '@tarojs/components'
import { useLoad, useRouter, navigateBack, showToast } from '@tarojs/taro'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'
import { Briefcase, DollarSign, Target, Sparkles, Clock, ChevronRight, Pencil, Save } from 'lucide-react-taro'
import './index.css'

interface Order {
  id: string
  title: string
  description: string
  budget: number
  status: string
  requirements: {
    contentType: string
    platforms: string[]
    targetAudience: string
    expectedResults: string
    deadline: string
  }
  result: Record<string, any>
  created_at: string
  updated_at: string
  avatars?: {
    id: string
    name: string
    avatar_url: string
  }
}

export default function OrderDetailPage() {
  const router = useRouter()
  const { id } = router.params
  
  const [order, setOrder] = useState<Order | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    budget: 0
  })

  useLoad(() => {
    if (id) {
      fetchOrder()
    }
  })

  const fetchOrder = async () => {
    setLoading(true)
    try {
      const res = await Network.request({ url: `/api/order/${id}` })
      if (res.data?.code === 200) {
        const orderData = res.data.data
        setOrder(orderData)
        setFormData({
          title: orderData.title,
          description: orderData.description,
          budget: orderData.budget
        })
      }
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showToast({ title: '请输入订单标题', icon: 'none' })
      return
    }
    
    setSaving(true)
    try {
      const res = await Network.request({
        url: `/api/order/${id}`,
        method: 'PUT',
        data: formData
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '保存成功', icon: 'success' })
        setEditing(false)
        fetchOrder()
      } else {
        showToast({ title: res.data?.message || '保存失败', icon: 'none' })
      }
    } catch (error) {
      console.error('保存订单失败:', error)
      showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = async () => {
    try {
      const res = await Network.request({
        url: `/api/order/${id}/cancel`,
        method: 'PUT'
      })
      
      if (res.data?.code === 200) {
        showToast({ title: '订单已取消', icon: 'success' })
        fetchOrder()
      }
    } catch (error) {
      showToast({ title: '取消失败', icon: 'none' })
    }
  }

  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { label: string; color: string; bg: string }> = {
      open: { label: '待接单', color: '#ffaa00', bg: 'rgba(255, 170, 0, 0.15)' },
      in_progress: { label: '进行中', color: '#00f5ff', bg: 'rgba(0, 245, 255, 0.15)' },
      reviewing: { label: '待审核', color: '#bf00ff', bg: 'rgba(191, 0, 255, 0.15)' },
      completed: { label: '已完成', color: '#00ff88', bg: 'rgba(0, 255, 136, 0.15)' },
      cancelled: { label: '已取消', color: '#64748b', bg: 'rgba(100, 116, 139, 0.15)' }
    }
    return statusMap[status] || { label: status, color: '#fff', bg: 'rgba(255,255,255,0.1)' }
  }

  const contentTypeMap: Record<string, string> = {
    article: '文章',
    image: '图片',
    video: '视频',
    mixed: '混合'
  }

  const platformMap: Record<string, string> = {
    wechat_mp: '公众号',
    xiaohongshu: '小红书',
    douyin: '抖音',
    bilibili: 'B站',
    weibo: '微博',
    wechat_video: '视频号'
  }

  if (loading) {
    return (
      <View className="order-detail-page">
        <View className="loading-state">
          <Text className="loading-text">加载中...</Text>
        </View>
      </View>
    )
  }

  if (!order) {
    return (
      <View className="order-detail-page">
        <View className="empty-state">
          <Text className="empty-text">订单不存在</Text>
        </View>
      </View>
    )
  }

  const statusInfo = getStatusInfo(order.status)

  return (
    <View className="order-detail-page">
      {/* 顶部导航 */}
      <View className="detail-header">
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">订单详情</Text>
        {!editing && order.status === 'open' && (
          <View className="edit-btn" onClick={() => setEditing(true)}>
            <Pencil size={18} color="#00f5ff" />
          </View>
        )}
        {editing && (
          <View className="edit-btn" onClick={handleSave}>
            <Save size={18} color="#00ff88" />
          </View>
        )}
        {!editing && order.status !== 'open' && <View className="header-placeholder" />}
      </View>

      <ScrollView className="detail-scroll" scrollY>
        {/* 状态卡片 */}
        <View className="status-card">
          <View className="status-badge" style={{ background: statusInfo.bg }}>
            <Text className="status-text" style={{ color: statusInfo.color }}>{statusInfo.label}</Text>
          </View>
          <View className="order-id">
            <Text className="id-label">订单编号</Text>
            <Text className="id-value">{order.id.slice(0, 8).toUpperCase()}</Text>
          </View>
        </View>

        {/* 分身信息 */}
        {order.avatars && (
          <View className="avatar-card">
            <View className="avatar-header">
              <Sparkles size={20} color="#00f5ff" />
              <Text className="avatar-title">执行分身</Text>
            </View>
            <View className="avatar-info">
              <Image 
                src={order.avatars.avatar_url || 'https://placehold.co/80x80/1a1a2e/ffffff?text=AI'}
                className="avatar-img"
                mode="aspectFill"
              />
              <View className="avatar-detail">
                <Text className="avatar-name">{order.avatars.name}</Text>
                <Text className="avatar-status">正在为您执行任务</Text>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.2)" />
            </View>
          </View>
        )}

        {/* 基本信息 */}
        <View className="section">
          <Text className="section-title">基本信息</Text>
          
          {editing ? (
            <>
              <View className="form-item">
                <Text className="form-label">订单标题</Text>
                <Input 
                  className="form-input"
                  value={formData.title}
                  onInput={e => setFormData({ ...formData, title: e.detail.value })}
                />
              </View>
              <View className="form-item">
                <Text className="form-label">需求描述</Text>
                <Textarea 
                  className="form-textarea"
                  value={formData.description}
                  onInput={e => setFormData({ ...formData, description: e.detail.value })}
                />
              </View>
              <View className="form-item">
                <Text className="form-label">预算金额</Text>
                <Input 
                  className="form-input"
                  type="digit"
                  value={String(formData.budget)}
                  onInput={e => setFormData({ ...formData, budget: parseFloat(e.detail.value) || 0 })}
                />
              </View>
              <View className="edit-actions">
                <Button className="cancel-edit-btn" onClick={() => setEditing(false)}>
                  <Text className="cancel-edit-text">取消</Text>
                </Button>
                <Button className="save-btn" onClick={handleSave} disabled={saving}>
                  <Text className="save-text">{saving ? '保存中...' : '保存'}</Text>
                </Button>
              </View>
            </>
          ) : (
            <>
              <View className="info-row">
                <View className="info-icon">
                  <Briefcase size={18} color="#00f5ff" />
                </View>
                <View className="info-content">
                  <Text className="info-label">订单标题</Text>
                  <Text className="info-value">{order.title}</Text>
                </View>
              </View>
              
              <View className="info-row">
                <View className="info-icon">
                  <Target size={18} color="#bf00ff" />
                </View>
                <View className="info-content">
                  <Text className="info-label">需求描述</Text>
                  <Text className="info-value">{order.description || '暂无描述'}</Text>
                </View>
              </View>
              
              <View className="info-row">
                <View className="info-icon">
                  <DollarSign size={18} color="#00ff88" />
                </View>
                <View className="info-content">
                  <Text className="info-label">预算金额</Text>
                  <Text className="info-value budget">¥{order.budget}</Text>
                </View>
              </View>
              
              <View className="info-row">
                <View className="info-icon">
                  <Clock size={18} color="#ffaa00" />
                </View>
                <View className="info-content">
                  <Text className="info-label">创建时间</Text>
                  <Text className="info-value">{order.created_at}</Text>
                </View>
              </View>
            </>
          )}
        </View>

        {/* 内容要求 */}
        {!editing && order.requirements && (
          <View className="section">
            <Text className="section-title">内容要求</Text>
            
            <View className="require-item">
              <Text className="require-label">内容类型</Text>
              <Text className="require-value">
                {contentTypeMap[order.requirements.contentType] || order.requirements.contentType}
              </Text>
            </View>
            
            {order.requirements.platforms && order.requirements.platforms.length > 0 && (
              <View className="require-item">
                <Text className="require-label">发布平台</Text>
                <View className="platform-tags">
                  {order.requirements.platforms.map(p => (
                    <View key={p} className="platform-tag">
                      <Text className="platform-tag-text">{platformMap[p] || p}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            
            {order.requirements.targetAudience && (
              <View className="require-item">
                <Text className="require-label">目标受众</Text>
                <Text className="require-value">{order.requirements.targetAudience}</Text>
              </View>
            )}
            
            {order.requirements.expectedResults && (
              <View className="require-item">
                <Text className="require-label">预期效果</Text>
                <Text className="require-value">{order.requirements.expectedResults}</Text>
              </View>
            )}
          </View>
        )}

        {/* 操作按钮 */}
        {!editing && order.status === 'open' && (
          <View className="action-section">
            <Button className="cancel-order-btn" onClick={handleCancel}>
              <Text className="cancel-order-text">取消订单</Text>
            </Button>
          </View>
        )}

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
