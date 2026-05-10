import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { 
  ArrowLeft, Sparkles, Image, Video, Music,
  DollarSign, Calendar, Check, Info, Send, CircleAlert
} from 'lucide-react-taro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Network } from '@/network'
import './index.css'

// 内容类型
const CONTENT_TYPES = [
  { id: 'text', label: '图文笔记', icon: Image, price: 10, color: '#f59e0b' },
  { id: 'video', label: '短视频', icon: Video, price: 30, color: '#ef4444' },
  { id: 'audio', label: '语音/音频', icon: Music, price: 15, color: '#8b5cf6' },
]

// 价格配置
const PRICE_CONFIG = {
  avatarBase: 5,
  maxAvatars: 10,
  maxQuantityPerAvatar: 20,
}

// 平台配置（带邀请说明）
const PLATFORM_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  requirement: string
}> = {
  douyin: {
    label: '抖音',
    icon: '🎵',
    color: '#00f2ea',
    requirement: '发布人需开通「抖音团购」功能'
  },
  xiaohongshu: {
    label: '小红书',
    icon: '📕',
    color: '#ff2442',
    requirement: '发布人需开通「小红书专业号」'
  },
  weibo: {
    label: '微博',
    icon: '📱',
    color: '#ff6b35',
    requirement: '无特殊要求'
  },
  wechat: {
    label: '微信',
    icon: '💬',
    color: '#07c160',
    requirement: '发布人需开通「视频号」'
  },
  bilibili: {
    label: 'B站',
    icon: '📺',
    color: '#00a1d6',
    requirement: '发布人需开通「创作激励」'
  },
  kuaishou: {
    label: '快手',
    icon: '📸',
    color: '#ff4906',
    requirement: '发布人需开通「快手小店」'
  },
}

export default function OrderCreate() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    contentType: 'text',
    platforms: [] as string[],
    requirements: {
      deadline: '',
    },
    avatarCount: 1,
    quantityPerAvatar: 1,
  })
  const [loading, setLoading] = useState(false)
  const [showPlatformTip, setShowPlatformTip] = useState(false)

  // 计算价格
  const selectedType = CONTENT_TYPES.find(t => t.id === form.contentType)
  const contentPricePerUnit = selectedType?.price || 10
  const totalPrice = {
    base: PRICE_CONFIG.avatarBase * form.avatarCount,
    content: contentPricePerUnit * form.quantityPerAvatar * form.avatarCount,
    get total() { return this.base + this.content }
  }

  // 切换内容类型
  const handleTypeChange = (typeId: string) => {
    setForm(prev => ({ ...prev, contentType: typeId }))
  }

  // 切换平台
  const handlePlatformToggle = (platformId: string) => {
    setForm(prev => {
      const platforms = prev.platforms.includes(platformId)
        ? prev.platforms.filter(p => p !== platformId)
        : [...prev.platforms, platformId]
      return { ...prev, platforms }
    })
  }

  // 获取选中平台的邀请说明
  const getPlatformRequirement = () => {
    if (form.platforms.length === 0) return null
    const requirements = form.platforms.map(p => PLATFORM_CONFIG[p]?.requirement).filter(Boolean)
    if (requirements.length === 0) return null
    return [...new Set(requirements)]
  }

  // 提交订单
  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
      return
    }
    if (!form.description.trim()) {
      Taro.showToast({ title: '请输入任务描述', icon: 'none' })
      return
    }
    if (form.platforms.length === 0) {
      Taro.showToast({ title: '请选择发布平台', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      const userInfo = Taro.getStorageSync('userInfo') || {}
      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        header: { 'x-user-id': userInfo.id || 'default_user' },
        data: {
          title: form.title,
          description: form.description,
          content_type: form.contentType,
          platforms: form.platforms,
          requirements: form.requirements,
          avatar_count: form.avatarCount,
          quantity_per_avatar: form.quantityPerAvatar,
          media: [],
          total_price: totalPrice.total,
        },
      })

      if (res.data.code === 200 || res.data.code === 0) {
        Taro.showToast({ title: '订单创建成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack(), 1500)
      } else {
        Taro.showToast({ title: res.data.msg || '创建失败', icon: 'none' })
      }
    } catch (err) {
      console.error('创建订单失败:', err)
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <View className="order-create-page">
      {/* 顶部导航 */}
      <View className="nav-header">
        <View className="nav-content">
          <View className="back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={24} color="#1f2937" />
          </View>
          <Text className="nav-title">创建任务</Text>
          <View className="nav-right" />
        </View>
      </View>

      <ScrollView className="content-scroll" scrollY>
        {/* 任务标题 */}
        <View className="title-section">
          <Input
            className="title-input"
            placeholder="输入任务标题，如：推广新品口红"
            placeholderClass="title-placeholder"
            value={form.title}
            onInput={(e: any) => setForm(prev => ({ ...prev, title: e.detail.value }))}
            maxlength={50}
          />
        </View>

        {/* 任务描述 */}
        <View className="section-card">
          <View className="card-header">
            <Text className="card-title">任务描述</Text>
            <View className="ai-write-btn">
              <Sparkles size={16} color="#7c3aed" />
              <Text className="ai-btn-text">AI帮写</Text>
            </View>
          </View>
          <Textarea
            className="desc-textarea"
            placeholder="详细描述任务要求，包括内容风格、表达方式、禁止出现的元素等..."
            placeholderClass="textarea-placeholder"
            value={form.description}
            onInput={(e: any) => setForm(prev => ({ ...prev, description: e.detail.value }))}
            maxlength={2000}
          />
          <Text className="char-count">{form.description.length}/2000</Text>
        </View>

        {/* 内容类型 */}
        <View className="section-card">
          <View className="card-header">
            <Text className="card-title">内容类型</Text>
          </View>
          <View className="type-grid">
            {CONTENT_TYPES.map(type => (
              <View
                key={type.id}
                className={`type-card ${form.contentType === type.id ? 'active' : ''}`}
                onClick={() => handleTypeChange(type.id)}
              >
                {form.contentType === type.id && (
                  <View className="type-check">
                    <Check size={20} color="#fff" strokeWidth={3} />
                  </View>
                )}
                <View className="type-icon-wrapper">
                  <type.icon size={32} color={type.color} />
                </View>
                <Text className={`type-text ${form.contentType === type.id ? 'active' : ''}`}>
                  {type.label}
                </Text>
                <Text className="type-price">¥{type.price}/份</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 发布平台 */}
        <View className="section-card">
          <View className="card-header">
            <Text className="card-title">发布平台</Text>
            <View 
              className="info-tip"
              onClick={() => setShowPlatformTip(!showPlatformTip)}
            >
              <Info size={16} color="#6b7280" />
            </View>
          </View>
          <View className="platform-grid">
            {Object.entries(PLATFORM_CONFIG).map(([id, config]) => (
              <View
                key={id}
                className={`platform-chip ${form.platforms.includes(id) ? 'active' : ''}`}
                onClick={() => handlePlatformToggle(id)}
              >
                <Text className="platform-icon">{config.icon}</Text>
                <Text className={`platform-name ${form.platforms.includes(id) ? 'active' : ''}`}>
                  {config.label}
                </Text>
                {form.platforms.includes(id) && (
                  <Check size={14} color="#3b82f6" />
                )}
              </View>
            ))}
          </View>

          {/* 平台邀请说明 */}
          {showPlatformTip && form.platforms.length > 0 && (
            <View className="platform-tip-card">
              <View className="tip-header">
                <CircleAlert size={18} color="#f59e0b" />
                <Text className="tip-title">平台要求</Text>
              </View>
              {getPlatformRequirement()?.map((req, i) => (
                <View key={i} className="tip-item">
                  <Text className="tip-text">{req}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 任务数量 */}
        <View className="section-card">
          <View className="card-header">
            <Text className="card-title">任务数量</Text>
          </View>

          <View className="counter-row">
            <View className="counter-info">
              <Text className="counter-label">选择分身数量</Text>
              <Text className="counter-hint">系统自动匹配符合条件的分身接单</Text>
            </View>
            <View className="counter-wrapper">
              <View
                className={`counter-btn ${form.avatarCount <= 1 ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.max(1, prev.avatarCount - 1) }))}
              >
                <Text className="counter-btn-text">−</Text>
              </View>
              <Input
                className="counter-input"
                type="number"
                value={form.avatarCount.toString()}
                onInput={(e: any) => {
                  const value = parseInt(e.detail.value) || 1
                  setForm(prev => ({ ...prev, avatarCount: Math.max(1, Math.min(PRICE_CONFIG.maxAvatars, value)) }))
                }}
              />
              <View
                className={`counter-btn ${form.avatarCount >= PRICE_CONFIG.maxAvatars ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.min(PRICE_CONFIG.maxAvatars, prev.avatarCount + 1) }))}
              >
                <Text className="counter-btn-text">+</Text>
              </View>
            </View>
          </View>

          <View className="counter-row">
            <View className="counter-info">
              <Text className="counter-label">每分身{selectedType?.label || '内容'}</Text>
              <Text className="counter-hint">每分身需创作的份数</Text>
            </View>
            <View className="counter-wrapper">
              <View
                className={`counter-btn ${form.quantityPerAvatar <= 1 ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, quantityPerAvatar: Math.max(1, prev.quantityPerAvatar - 1) }))}
              >
                <Text className="counter-btn-text">−</Text>
              </View>
              <Input
                className="counter-input"
                type="number"
                value={form.quantityPerAvatar.toString()}
                onInput={(e: any) => {
                  const value = parseInt(e.detail.value) || 1
                  setForm(prev => ({ ...prev, quantityPerAvatar: Math.max(1, Math.min(PRICE_CONFIG.maxQuantityPerAvatar, value)) }))
                }}
              />
              <View
                className={`counter-btn ${form.quantityPerAvatar >= PRICE_CONFIG.maxQuantityPerAvatar ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, quantityPerAvatar: Math.min(PRICE_CONFIG.maxQuantityPerAvatar, prev.quantityPerAvatar + 1) }))}
              >
                <Text className="counter-btn-text">+</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 截止日期 */}
        <View className="section-card">
          <View className="card-header">
            <Text className="card-title">截止日期</Text>
          </View>
          <View className="date-picker-btn">
            {form.requirements.deadline ? (
              <Text className="date-value">{form.requirements.deadline}</Text>
            ) : (
              <Text className="date-placeholder">选择任务截止日期</Text>
            )}
            <Calendar size={20} color="#9ca3af" />
          </View>
        </View>

        {/* 价格汇总 */}
        <View className="section-card price-card">
          <View className="price-row">
            <Text className="price-label">分身基础费</Text>
            <Text className="price-value">¥{PRICE_CONFIG.avatarBase} × {form.avatarCount}</Text>
          </View>
          <View className="price-row">
            <Text className="price-label">{selectedType?.label || '内容'}费</Text>
            <Text className="price-value">¥{contentPricePerUnit} × {form.quantityPerAvatar} × {form.avatarCount}</Text>
          </View>
          <View className="price-divider" />
          <View className="price-total">
            <Text className="total-label">预估总价</Text>
            <View className="total-amount">
              <Text className="amount-value">¥{totalPrice.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* 提交按钮 */}
        <View className="submit-section">
          <Button
            className="submit-btn secondary"
            onClick={handleSubmit}
            disabled={loading}
          >
            <Send size={18} color="#3b82f6" />
            <Text className="btn-text">暂不支付，创建订单</Text>
          </Button>
          <Button
            className="submit-btn primary"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Text className="btn-text">发布中...</Text>
            ) : (
              <>
                <DollarSign size={18} color="#fff" />
                <Text className="btn-text">支付 ¥{totalPrice.total.toFixed(2)} 并发布</Text>
              </>
            )}
          </Button>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
