import Taro, { navigateBack, showToast, navigateTo, useLoad, getLocation } from '@tarojs/taro'
import { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { Briefcase, DollarSign, Target, Sparkles } from 'lucide-react-taro'
import './index.css'

interface OrderForm {
  title: string
  description: string
  budget: string
  requirements: {
    contentType: string
    platforms: string[]
    targetAudience: string
    expectedResults: string
    deadline: string
  }
}

export default function OrderCreatePage() {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<OrderForm>({
    title: '',
    description: '',
    budget: '',
    requirements: {
      contentType: 'article',
      platforms: [],
      targetAudience: '',
      expectedResults: '',
      deadline: ''
    }
  })
  
  // 状态栏和胶囊按钮适配
  const [statusBarHeight, setStatusBarHeight] = useState(20)
  const [capsuleWidth, setCapsuleWidth] = useState(160)
  
  useLoad(() => {
    // 初始化状态栏和胶囊按钮信息
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    const menuButtonBoundingClientRect = Taro.getMenuButtonBoundingClientRect()
    if (menuButtonBoundingClientRect) {
      const rightMargin = systemInfo.screenWidth - menuButtonBoundingClientRect.right
      const capsuleWidthWithMargins = rightMargin * 2 + menuButtonBoundingClientRect.width
      setCapsuleWidth(capsuleWidthWithMargins)
    }
  })

  const contentTypes = [
    { value: 'article', label: '文章', icon: '📝' },
    { value: 'image', label: '图片', icon: '🖼️' },
    { value: 'video', label: '视频', icon: '🎬' },
    { value: 'mixed', label: '混合', icon: '📊' }
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

  const handleSubmit = async () => {
    if (!form.title.trim()) {
      showToast({ title: '请输入订单标题', icon: 'none' })
      return
    }
    if (!form.description.trim()) {
      showToast({ title: '请输入需求描述', icon: 'none' })
      return
    }
    if (!form.budget || parseFloat(form.budget) <= 0) {
      showToast({ title: '请输入有效预算', icon: 'none' })
      return
    }
    if (form.requirements.platforms.length === 0) {
      showToast({ title: '请选择发布平台', icon: 'none' })
      return
    }

    setLoading(true)
    try {
      // 获取地理位置
      let locationData: {
        latitude: number | null
        longitude: number | null
      } = {
        latitude: null,
        longitude: null
      }

      try {
        const locationRes = await getLocation({
          type: 'wgs84'
        })
        locationData = {
          latitude: locationRes.latitude,
          longitude: locationRes.longitude
        }
        console.log('获取地理位置成功:', locationData)
      } catch (locationError) {
        console.warn('获取地理位置失败，将使用默认值:', locationError)
        // 获取地理位置失败不影响订单创建，继续执行
      }

      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: {
          title: form.title,
          description: form.description,
          budget: parseFloat(form.budget),
          content_type: form.requirements.contentType,
          platforms: form.requirements.platforms,
          target_audience: form.requirements.targetAudience,
          deadline: form.requirements.deadline || null,
          ...locationData
        }
      })

      if (res.data?.code === 200) {
        showToast({ title: '发布成功', icon: 'success' })
        const orderId = res.data.data?.id
        setTimeout(() => {
          // 跳转到匹配页面
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
      {/* 顶部导航 */}
      <View className="create-header" style={{ paddingTop: `${statusBarHeight}px` }}>
        <View className="header-back" onClick={() => navigateBack()}>
          <Text className="back-text">← 返回</Text>
        </View>
        <Text className="header-title">发布订单</Text>
        <View className="header-placeholder" style={{ width: `${capsuleWidth}rpx` }} />
      </View>

      <ScrollView className="create-scroll" scrollY>
        {/* 基本信息 */}
        <View className="form-section">
          <Text className="section-title">基本信息</Text>
          
          <View className="form-item">
            <View className="form-label">
              <Briefcase size={18} color="#00f5ff" />
              <Text className="label-text">订单标题</Text>
            </View>
            <Input 
              className="custom-input"
              placeholder="请输入订单标题"
              value={form.title}
              onInput={e => setForm({ ...form, title: e.detail.value })}
            />
          </View>

          <View className="form-item">
            <View className="form-label">
              <Target size={18} color="#bf00ff" />
              <Text className="label-text">需求描述</Text>
            </View>
            <Textarea 
              className="custom-textarea"
              placeholder="详细描述您的营销需求，包括内容方向、风格要求等"
              value={form.description}
              onInput={e => setForm({ ...form, description: e.detail.value })}
              maxlength={500}
            />
            <Text className="char-count">{form.description.length}/500</Text>
          </View>

          <View className="form-item">
            <View className="form-label">
              <DollarSign size={18} color="#00ff88" />
              <Text className="label-text">预算金额</Text>
            </View>
            <View className="budget-input-wrap">
              <Text className="currency">¥</Text>
              <Input 
                className="budget-input"
                type="digit"
                placeholder="0.00"
                value={form.budget}
                onInput={e => setForm({ ...form, budget: e.detail.value })}
              />
            </View>
          </View>
        </View>

        {/* 内容要求 */}
        <View className="form-section">
          <Text className="section-title">内容要求</Text>
          
          <View className="form-item">
            <Text className="form-label-text">内容类型</Text>
            <View className="type-options">
              {contentTypes.map(type => (
                <View 
                  key={type.value}
                  className={`type-option ${form.requirements.contentType === type.value ? 'active' : ''}`}
                  onClick={() => setForm(prev => ({
                    ...prev,
                    requirements: { ...prev.requirements, contentType: type.value }
                  }))}
                >
                  <Text className="type-icon">{type.icon}</Text>
                  <Text className="type-label">{type.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="form-item">
            <Text className="form-label-text">发布平台（可多选）</Text>
            <View className="platform-options">
              {platforms.map(platform => (
                <View 
                  key={platform.value}
                  className={`platform-option ${form.requirements.platforms.includes(platform.value) ? 'active' : ''}`}
                  onClick={() => togglePlatform(platform.value)}
                >
                  <Text className="platform-label">{platform.label}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className="form-item">
            <Text className="form-label-text">目标受众</Text>
            <Input 
              className="custom-input"
              placeholder="例如：18-35岁都市白领女性"
              value={form.requirements.targetAudience}
              onInput={e => setForm(prev => ({
                ...prev,
                requirements: { ...prev.requirements, targetAudience: e.detail.value }
              }))}
            />
          </View>

          <View className="form-item">
            <Text className="form-label-text">预期效果</Text>
            <Textarea 
              className="custom-textarea"
              placeholder="例如：阅读量10万+，点赞1000+"
              value={form.requirements.expectedResults}
              onInput={e => setForm(prev => ({
                ...prev,
                requirements: { ...prev.requirements, expectedResults: e.detail.value }
              }))}
              maxlength={200}
            />
          </View>

          <View className="form-item">
            <Text className="form-label-text">截止日期</Text>
            <Input
              className="custom-input"
              placeholder={form.requirements.deadline || '点击选择截止日期'}
              value={form.requirements.deadline}
              onInput={e => setForm(prev => ({
                ...prev,
                requirements: { ...prev.requirements, deadline: e.detail.value }
              }))}
              onFocus={() => {
                Taro.showModal({
                  title: '提示',
                  content: '请输入日期，格式：YYYY-MM-DD',
                  showCancel: false
                })
              }}
            />
          </View>
        </View>

        {/* AI分身执行说明 */}
        <View className="ai-note">
          <Sparkles size={20} color="#00f5ff" />
          <Text className="ai-note-text">
            发布后，系统将自动匹配最合适的AI分身为您执行任务，包括策划、内容创作、分发和数据反馈
          </Text>
        </View>

        {/* 提交按钮 */}
        <View className="submit-section">
          <Button 
            className={`submit-btn ${loading ? 'loading' : ''}`}
            onClick={handleSubmit}
            disabled={loading}
          >
            <Text className="submit-text">{loading ? '发布中...' : '发布订单'}</Text>
          </Button>
        </View>

        <View className="bottom-space" />
      </ScrollView>
    </View>
  )
}
