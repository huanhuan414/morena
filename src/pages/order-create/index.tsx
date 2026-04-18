import Taro, { navigateBack, showToast, navigateTo, useLoad, getLocation } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input as BaseInput } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import {
  Briefcase, DollarSign, Target, Sparkles, Users, ArrowLeft, Image,
  Video, FileText, Calculator, TrendingUp, Zap, Check
} from 'lucide-react-taro'
import './index.css'

interface OrderForm {
  title: string
  description: string
  avatarCount: number
  requirements: {
    contentType: string
    platforms: string[]
    targetAudience: string
    expectedResults: string
    deadline: string
  }
  // 新增：内容数量配置
  contentQuantity: {
    imageCount: number
    videoCount: number
    articleCount: number
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
  const [form, setForm] = useState<OrderForm>({
    title: '',
    description: '',
    avatarCount: 1,
    requirements: {
      contentType: 'article',
      platforms: [],
      targetAudience: '',
      expectedResults: '',
      deadline: ''
    },
    contentQuantity: {
      imageCount: 0,
      videoCount: 0,
      articleCount: 1
    }
  })

  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)

    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
  })

  // 计算总价格
  const totalPrice = useMemo(() => {
    const {
      avatarCount,
      contentQuantity
    } = form

    const basePrice = avatarCount * PRICE_CONFIG.avatarBase
    const imagePrice = contentQuantity.imageCount * PRICE_CONFIG.image * avatarCount
    const videoPrice = contentQuantity.videoCount * PRICE_CONFIG.video * avatarCount
    const articlePrice = contentQuantity.articleCount * PRICE_CONFIG.article * avatarCount

    return {
      base: basePrice,
      image: imagePrice,
      video: videoPrice,
      article: articlePrice,
      total: basePrice + imagePrice + videoPrice + articlePrice
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

  const updateQuantity = (type: 'imageCount' | 'videoCount' | 'articleCount', value: number) => {
    setForm(prev => ({
      ...prev,
      contentQuantity: {
        ...prev.contentQuantity,
        [type]: Math.max(0, value)
      }
    }))
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
    if (totalPrice.total <= 0) {
      showToast({ title: '请至少选择一项内容', icon: 'none' })
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
            image_count: form.contentQuantity.imageCount,
            video_count: form.contentQuantity.videoCount,
            article_count: form.contentQuantity.articleCount
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

  return (
    <View className="order-create-page">
      {/* 背景特效 */}
      <View className="bg-effects">
        <View className="bg-orb orb-1"></View>
        <View className="bg-orb orb-2"></View>
        <View className="bg-orb orb-3"></View>
      </View>

      {/* 顶部导航 */}
      <View className="nav-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="nav-content">
          <View className="nav-left">
            <View className="back-btn" onClick={() => navigateBack()}>
              <ArrowLeft size={24} color="#fff" />
            </View>
            <Text className="nav-title">发布订单</Text>
          </View>
          <View className="nav-right" style={{ width: `${capsuleWidth}rpx` }}></View>
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
            <Briefcase size={20} color="#00f5ff" />
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
            <Target size={20} color="#00f5ff" />
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
                  style={isActive ? { borderColor: type.color } : {}}
                >
                  <Icon size={32} color={isActive ? type.color : 'rgba(255,255,255,0.4)'} />
                  <Text className="type-text">{type.label}</Text>
                  {isActive && <View className="type-check" style={{ background: type.color }}></View>}
                </View>
              )
            })}
          </View>
        </View>

        {/* 发布平台 */}
        <View className="section-card">
          <View className="card-header">
            <Sparkles size={20} color="#00f5ff" />
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
                  <Text className="platform-text">{platform.label}</Text>
                  {isActive && <Check size={16} color="#00f5ff" />}
                </View>
              )
            })}
          </View>
        </View>

        {/* 价格计算器 */}
        <View className="section-card price-card">
          <View className="card-header">
            <Calculator size={20} color="#00f5ff" />
            <Text className="card-title">价格计算</Text>
          </View>

          {/* 分身数量 */}
          <View className="price-row">
            <View className="price-label">
              <Users size={18} color="rgba(255,255,255,0.6)" />
              <Text className="label-text">分身数量</Text>
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
          <Text className="price-hint">
            ¥{PRICE_CONFIG.avatarBase}/个 × {form.avatarCount} = ¥{totalPrice.base}
          </Text>

          {/* 图片数量 */}
          <View className="price-row">
            <View className="price-label">
              <Image size={18} color="rgba(255,255,255,0.6)" />
              <Text className="label-text">图片数量</Text>
            </View>
            <View className="counter-wrapper">
              <View
                className="counter-btn"
                onClick={() => updateQuantity('imageCount', form.contentQuantity.imageCount - 1)}
              >
                <Text>-</Text>
              </View>
              <BaseInput
                className="counter-input"
                type="number"
                value={form.contentQuantity.imageCount.toString()}
                onInput={(e: any) => updateQuantity('imageCount', parseInt(e.detail.value) || 0)}
              />
              <View
                className="counter-btn"
                onClick={() => updateQuantity('imageCount', form.contentQuantity.imageCount + 1)}
              >
                <Text>+</Text>
              </View>
            </View>
          </View>
          <Text className="price-hint">
            ¥{PRICE_CONFIG.image}/张 × {form.contentQuantity.imageCount} × {form.avatarCount}个分身 = ¥{totalPrice.image}
          </Text>

          {/* 视频数量 */}
          <View className="price-row">
            <View className="price-label">
              <Video size={18} color="rgba(255,255,255,0.6)" />
              <Text className="label-text">视频数量</Text>
            </View>
            <View className="counter-wrapper">
              <View
                className="counter-btn"
                onClick={() => updateQuantity('videoCount', form.contentQuantity.videoCount - 1)}
              >
                <Text>-</Text>
              </View>
              <BaseInput
                className="counter-input"
                type="number"
                value={form.contentQuantity.videoCount.toString()}
                onInput={(e: any) => updateQuantity('videoCount', parseInt(e.detail.value) || 0)}
              />
              <View
                className="counter-btn"
                onClick={() => updateQuantity('videoCount', form.contentQuantity.videoCount + 1)}
              >
                <Text>+</Text>
              </View>
            </View>
          </View>
          <Text className="price-hint">
            ¥{PRICE_CONFIG.video}/个 × {form.contentQuantity.videoCount} × {form.avatarCount}个分身 = ¥{totalPrice.video}
          </Text>

          {/* 图文数量 */}
          <View className="price-row">
            <View className="price-label">
              <FileText size={18} color="rgba(255,255,255,0.6)" />
              <Text className="label-text">图文数量</Text>
            </View>
            <View className="counter-wrapper">
              <View
                className="counter-btn"
                onClick={() => updateQuantity('articleCount', form.contentQuantity.articleCount - 1)}
              >
                <Text>-</Text>
              </View>
              <BaseInput
                className="counter-input"
                type="number"
                value={form.contentQuantity.articleCount.toString()}
                onInput={(e: any) => updateQuantity('articleCount', parseInt(e.detail.value) || 0)}
              />
              <View
                className="counter-btn"
                onClick={() => updateQuantity('articleCount', form.contentQuantity.articleCount + 1)}
              >
                <Text>+</Text>
              </View>
            </View>
          </View>
          <Text className="price-hint">
            ¥{PRICE_CONFIG.article}/篇 × {form.contentQuantity.articleCount} × {form.avatarCount}个分身 = ¥{totalPrice.article}
          </Text>

          {/* 总价 */}
          <View className="total-price-section">
            <View className="total-label">
              <DollarSign size={24} color="#00f5ff" />
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
            <Zap size={20} color="#00f5ff" />
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
            <BaseInput
              className="info-input"
              placeholder={form.requirements.deadline || 'YYYY-MM-DD'}
              value={form.requirements.deadline}
              onInput={(e: any) => setForm(prev => ({
                ...prev,
                requirements: { ...prev.requirements, deadline: e.detail.value }
              }))}
            />
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
              <Text>发布中...</Text>
            ) : (
              <>
                <TrendingUp size={18} color="#fff" />
                <Text>支付 ¥{totalPrice.total.toFixed(2)} 并发布</Text>
              </>
            )}
          </Button>
        </View>

        <View className="bottom-space"></View>
      </ScrollView>
    </View>
  )
}
