import Taro, { navigateBack, showToast, navigateTo, useLoad, getLocation } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Input as BaseInput } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  Briefcase, DollarSign, Target, Sparkles, Users, ArrowLeft, Image,
  Video, FileText, Calculator, TrendingUp, Zap, Check, Calendar as CalendarIcon
} from 'lucide-react-taro'
import './index.css'

interface OrderForm {
  title: string
  description: string
  avatarCount: number
  quantityPerAvatar: number // 每个分身做的份数
  requirements: {
    contentType: string
    platforms: string[]
    targetAudience: string
    expectedResults: string
    deadline: string
  }
}

// 价格配置（可调整）
const PRICE_CONFIG = {
  avatarBase: 5,      // 分身基础费用（元/个）
  image: 0.5,         // 图片（元/张）
  video: 30,          // 视频（元/个）
  article: 3          // 图文（元/篇）
}

export default function OrderCreatePage() {
  const [loading, setLoading] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [form, setForm] = useState<OrderForm>({
    title: '',
    description: '',
    avatarCount: 1,
    quantityPerAvatar: 1,
    requirements: {
      contentType: 'article',
      platforms: [],
      targetAudience: '',
      expectedResults: '',
      deadline: ''
    }
  })

  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
  })

  // 计算总价格
  const totalPrice = useMemo(() => {
    const { avatarCount, quantityPerAvatar, requirements } = form

    const basePrice = avatarCount * PRICE_CONFIG.avatarBase

    // 根据内容类型计算内容价格
    let contentPrice = 0
    switch (requirements.contentType) {
      case 'image':
        contentPrice = quantityPerAvatar * PRICE_CONFIG.image * avatarCount
        break
      case 'video':
        contentPrice = quantityPerAvatar * PRICE_CONFIG.video * avatarCount
        break
      case 'article':
        contentPrice = quantityPerAvatar * PRICE_CONFIG.article * avatarCount
        break
      case 'mixed':
        // 混合类型，按图文价格计算
        contentPrice = quantityPerAvatar * PRICE_CONFIG.article * avatarCount
        break
    }

    return {
      base: basePrice,
      content: contentPrice,
      total: basePrice + contentPrice
    }
  }, [form])

  const contentTypes = [
    { value: 'article', label: '图文', icon: FileText, color: '#3b82f6' },
    { value: 'image', label: '图片', icon: Image, color: '#8b5cf6' },
    { value: 'video', label: '视频', icon: Video, color: '#ec4899' },
    { value: 'mixed', label: '混合', icon: Sparkles, color: '#22c55e' }
  ]

  const platforms = [
    { value: 'wechat_mp', label: '公众号' },
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'douyin', label: '抖音' },
    { value: 'bilibili', label: 'B站' },
    { value: 'weibo', label: '微博' },
    { value: 'wechat_video', label: '视频号' }
  ]

  const togglePlatform = (platform: string) => {
    setForm(prev => ({
      ...prev,
      requirements: {
        ...prev.requirements,
        platforms: prev.requirements.platforms.includes(platform)
          ? prev.requirements.platforms.filter(p => p !== platform)
          : [...prev.requirements.platforms, platform]
      }
    }))
  }

  const handleDateSelect = (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    setForm(prev => ({
      ...prev,
      requirements: { ...prev.requirements, deadline: dateStr }
    }))
    setShowCalendar(false)
  }

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showToast({ title: '请输入订单标题', icon: 'none' })
      return
    }
    if (!form.description.trim()) {
      showToast({ title: '请输入需求描述', icon: 'none' })
      return
    }
    if (form.requirements.platforms.length === 0) {
      showToast({ title: '请选择发布平台', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      let locationData = {
        latitude: null as number | null,
        longitude: null as number | null
      }

      try {
        const locationRes = await getLocation({ type: 'wgs84' })
        locationData = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
      } catch (error) {
        console.warn('获取地理位置失败:', error)
      }

      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: {
          title: form.title,
          description: form.description,
          budget: totalPrice.total,
          content_type: form.requirements.contentType,
          platforms: form.requirements.platforms,
          target_audience: form.requirements.targetAudience,
          deadline: form.requirements.deadline || null,
          expected_quantity: form.avatarCount,
          content_config: {
            quantity_per_avatar: form.quantityPerAvatar
          },
          ...locationData
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '发布成功', icon: 'success' })
        const orderId = res.data.data?.id
        setTimeout(() => {
          navigateTo({
            url: `/pages/order-matching/index?orderId=${orderId}`
          })
        }, 1500)
      } else {
        showToast({ title: res.data?.message || '发布失败', icon: 'none' })
      }
    } catch (error) {
      console.error('发布订单失败:', error)
      showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const selectedType = contentTypes.find(t => t.value === form.requirements.contentType)
  const contentPricePerUnit = selectedType
    ? (form.requirements.contentType === 'image' ? PRICE_CONFIG.image :
       form.requirements.contentType === 'video' ? PRICE_CONFIG.video :
       form.requirements.contentType === 'article' ? PRICE_CONFIG.article :
       PRICE_CONFIG.article)
    : 0

  return (
    <View className="order-create-page">
      {/* 顶部导航 */}
      <View className="nav-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="nav-content">
          <View className="back-btn" onClick={() => navigateBack()}>
            <ArrowLeft size={24} color="#1f2937" />
          </View>
          <Text className="nav-title">发布订单</Text>
          <View className="nav-right"></View>
        </View>
      </View>

      <ScrollView className="content-scroll" scrollY>
        {/* 标题输入 */}
        <View className="title-section">
          <BaseInput
            className="title-input"
            placeholder="输入订单标题，例如：小红书美妆内容创作"
            value={form.title}
            onInput={(e: any) => setForm({ ...form, title: e.detail.value })}
            placeholderClass="title-placeholder"
          />
        </View>

        {/* 描述输入 */}
        <View className="section-card">
          <View className="card-header">
            <Briefcase size={20} color="#3b82f6" />
            <Text className="card-title">需求描述</Text>
          </View>
          <Textarea
            className="desc-textarea"
            placeholder="详细描述您的营销需求，包括内容方向、风格要求、品牌调性等..."
            value={form.description}
            onInput={(e: any) => setForm({ ...form, description: e.detail.value })}
            maxlength={500}
            placeholderClass="textarea-placeholder"
          />
          <Text className="char-count">{form.description.length}/500</Text>
        </View>

        {/* 内容类型选择 */}
        <View className="section-card">
          <View className="card-header">
            <Target size={20} color="#3b82f6" />
            <Text className="card-title">内容类型</Text>
          </View>
          <View className="type-grid">
            {contentTypes.map((type) => {
              const Icon = type.icon
              const isActive = form.requirements.contentType === type.value
              return (
                <View
                  key={type.value}
                  className={`type-card ${isActive ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    requirements: { ...prev.requirements, contentType: type.value }
                  }))}
                  style={isActive ? { borderColor: type.color, background: `${type.color}15` } : {}}
                >
                  <Icon size={32} color={isActive ? type.color : '#9ca3af'} />
                  <Text className={`type-text ${isActive ? 'active' : ''}`}>{type.label}</Text>
                  {isActive && <View className="type-check" style={{ background: type.color }}></View>}
                </View>
              )
            })}
          </View>
        </View>

        {/* 发布平台 */}
        <View className="section-card">
          <View className="card-header">
            <Sparkles size={20} color="#3b82f6" />
            <Text className="card-title">发布平台</Text>
          </View>
          <View className="platform-grid">
            {platforms.map((platform) => {
              const isActive = form.requirements.platforms.includes(platform.value)
              return (
                <View
                  key={platform.value}
                  className={`platform-chip ${isActive ? 'active' : ''}`}
                  onClick={() => togglePlatform(platform.value)}
                >
                  <Text className={`platform-text ${isActive ? 'active' : ''}`}>{platform.label}</Text>
                  {isActive && <Check size={16} color="#3b82f6" />}
                </View>
              )
            })}
          </View>
        </View>

        {/* 价格计算器 */}
        <View className="section-card price-card">
          <View className="card-header">
            <Calculator size={20} color="#3b82f6" />
            <Text className="card-title">价格计算</Text>
          </View>

          {/* 分身数量 */}
          <View className="price-row">
            <View className="price-label">
              <Users size={20} color="#6b7280" />
              <View>
                <Text className="label-text">分身数量</Text>
                <Text className="label-hint">需要的AI分身个数</Text>
              </View>
            </View>
            <View className="counter-wrapper">
              <View
                className={`counter-btn ${form.avatarCount <= 1 ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.max(1, prev.avatarCount - 1) }))}
              >
                <Text>-</Text>
              </View>
              <BaseInput
                className="counter-input"
                type="number"
                value={form.avatarCount.toString()}
                onInput={(e: any) => {
                  const value = parseInt(e.detail.value) || 1
                  setForm(prev => ({ ...prev, avatarCount: Math.max(1, Math.min(10, value)) }))
                }}
              />
              <View
                className={`counter-btn ${form.avatarCount >= 10 ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.min(10, prev.avatarCount + 1) }))}
              >
                <Text>+</Text>
              </View>
            </View>
          </View>

          {/* 每个分身做几份 */}
          <View className="price-row">
            <View className="price-label">
              {selectedType && <selectedType.icon size={20} color="#6b7280" />}
              <View>
                <Text className="label-text">每个分身做{selectedType?.label || '内容'}</Text>
                <Text className="label-hint">¥{contentPricePerUnit}/份</Text>
              </View>
            </View>
            <View className="counter-wrapper">
              <View
                className={`counter-btn ${form.quantityPerAvatar <= 1 ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, quantityPerAvatar: Math.max(1, prev.quantityPerAvatar - 1) }))}
              >
                <Text>-</Text>
              </View>
              <BaseInput
                className="counter-input"
                type="number"
                value={form.quantityPerAvatar.toString()}
                onInput={(e: any) => {
                  const value = parseInt(e.detail.value) || 1
                  setForm(prev => ({ ...prev, quantityPerAvatar: Math.max(1, Math.min(20, value)) }))
                }}
              />
              <View
                className={`counter-btn ${form.quantityPerAvatar >= 20 ? 'disabled' : ''}`}
                onClick={() => setForm(prev => ({ ...prev, quantityPerAvatar: Math.min(20, prev.quantityPerAvatar + 1) }))}
              >
                <Text>+</Text>
              </View>
            </View>
          </View>

          {/* 价格明细 */}
          <View className="price-breakdown">
            <View className="breakdown-item">
              <Text className="breakdown-label">分身基础费用</Text>
              <Text className="breakdown-value">¥{PRICE_CONFIG.avatarBase}/个 × {form.avatarCount}个</Text>
            </View>
            <View className="breakdown-price">
              <Text className="price-amount">¥{totalPrice.base}</Text>
            </View>

            <View className="breakdown-item">
              <Text className="breakdown-label">{selectedType?.label}内容费用</Text>
              <Text className="breakdown-value">¥{contentPricePerUnit}/份 × {form.quantityPerAvatar}份 × {form.avatarCount}个分身</Text>
            </View>
            <View className="breakdown-price">
              <Text className="price-amount">¥{totalPrice.content}</Text>
            </View>
          </View>

          {/* 总价 */}
          <View className="total-price-section">
            <View className="total-label">
              <DollarSign size={24} color="#3b82f6" />
              <Text className="total-text">预估总价</Text>
            </View>
            <View className="total-amount">
              <Text className="amount-text">¥{totalPrice.total.toFixed(2)}</Text>
            </View>
          </View>
        </View>

        {/* 其他信息 */}
        <View className="section-card">
          <View className="card-header">
            <Zap size={20} color="#3b82f6" />
            <Text className="card-title">其他信息</Text>
          </View>

          <View className="info-item">
            <Text className="info-label">目标受众</Text>
            <BaseInput
              className="info-input"
              placeholder="例如：18-35岁都市白领女性"
              value={form.requirements.targetAudience}
              onInput={(e: any) => setForm(prev => ({
                ...prev,
                requirements: { ...prev.requirements, targetAudience: e.detail.value }
              }))}
            />
          </View>

          <View className="info-item">
            <Text className="info-label">预期效果</Text>
            <Textarea
              className="info-textarea"
              placeholder="例如：阅读量10万+，点赞1000+"
              value={form.requirements.expectedResults}
              onInput={(e: any) => setForm(prev => ({
                ...prev,
                requirements: { ...prev.requirements, expectedResults: e.detail.value }
              }))}
              maxlength={200}
            />
          </View>

          <View className="info-item">
            <Text className="info-label">截止日期</Text>
            <Popover open={showCalendar} onOpenChange={setShowCalendar}>
              <PopoverTrigger asChild>
                <View
                  className="info-input date-input"
                  onClick={() => setShowCalendar(true)}
                >
                  {form.requirements.deadline ? (
                    <Text className="date-text">{form.requirements.deadline}</Text>
                  ) : (
                    <Text className="date-placeholder">选择截止日期</Text>
                  )}
                  <CalendarIcon size={18} color="#9ca3af" />
                </View>
              </PopoverTrigger>
              <PopoverContent sideOffset={4} align="start">
                <Calendar
                  mode="single"
                  selected={form.requirements.deadline ? new Date(form.requirements.deadline) : undefined}
                  onSelect={(date) => date && handleDateSelect(date)}
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </View>
        </View>

        {/* 提交按钮 */}
        <View className="submit-section">
          <Button
            className={`submit-btn ${loading ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <Text className="btn-text">发布中...</Text>
            ) : (
              <>
                <TrendingUp size={18} color="#fff" />
                <Text className="btn-text">支付 ¥{totalPrice.total.toFixed(2)} 并发布</Text>
              </>
            )}
          </Button>
        </View>

        <View className="bottom-space"></View>
      </ScrollView>
    </View>
  )
}
