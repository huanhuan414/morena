import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Send, Check, ChevronRight, Loader, ChevronLeft, FileText } from 'lucide-react-taro'
import { Network } from '@/network'
import './index.css'

// 内容类型配置
const CONTENT_TYPES = [
  { id: 'text', label: '纯文案', icon: '📝', price: 5, prompt: '撰写吸引人的文案' },
  { id: 'image', label: '图文笔记', icon: '🖼️', price: 15, prompt: '撰写图文笔记内容' },
  { id: 'video', label: '短视频脚本', icon: '🎬', price: 20, prompt: '撰写短视频脚本' },
  { id: 'live', label: '直播话术', icon: '📺', price: 25, prompt: '撰写直播带货话术' },
]

// 平台配置
const PLATFORM_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  requirements: { id: string; label: string; placeholder: string }[]
}> = {
  douyin: {
    label: '抖音',
    icon: '🎵',
    color: '#000000',
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：1000' },
      { id: 'group', label: '需开通团购', placeholder: '是/否' },
      { id: 'cert', label: '需蓝V认证', placeholder: '是/否' },
    ]
  },
  wechat_mp: {
    label: '微信公众号',
    icon: '📢',
    color: '#1677FF',
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：500' },
      { id: 'account_type', label: '账号类型', placeholder: '订阅号/服务号' },
    ]
  },
  xiaohongshu: {
    label: '小红书',
    icon: '📕',
    color: '#FF2442',
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：500' },
      { id: 'cert', label: '需专业号', placeholder: '是/否' },
    ]
  },
  wechat: {
    label: '微信',
    icon: '💬',
    color: '#07C160',
    requirements: [
      { id: 'fans', label: '视频号粉丝', placeholder: '如：1000' },
      { id: 'moments', label: '需发朋友圈', placeholder: '是/否' },
    ]
  },
  weibo: {
    label: '微博',
    icon: '🌐',
    color: '#FF8200',
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：10000' },
      { id: 'cert', label: '需认证', placeholder: '是/否' },
    ]
  },
  kuaishou: {
    label: '快手',
    icon: '📸',
    color: '#FF4906',
    requirements: [
      { id: 'fans', label: '粉丝量要求', placeholder: '如：1000' },
      { id: 'shop', label: '需开通快手小店', placeholder: '是/否' },
    ]
  },
}

export default function OrderCreate() {
  const [form, setForm] = useState({
    title: '',
    description: '',
    contentType: 'text',
    platforms: [] as string[],
    optionalRequirements: {} as Record<string, string>,
    avatarCount: 1,
    quantityPerAvatar: 1,
  })
  const [aiLoading, setAiLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPlatformReq, setShowPlatformReq] = useState(false)

  // 计算价格
  const selectedType = CONTENT_TYPES.find(t => t.id === form.contentType)
  const contentPricePerUnit = selectedType?.price || 10
  const totalPrice = {
    base: 50 * form.avatarCount,
    content: contentPricePerUnit * form.quantityPerAvatar * form.avatarCount,
    get total() { return this.base + this.content }
  }

  // AI帮写
  const handleAIGenerate = async () => {
    if (form.platforms.length === 0) {
      Taro.showToast({ title: '请先选择发布平台', icon: 'none' })
      return
    }
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
      return
    }

    setAiLoading(true)
    try {
      // 构建平台名称列表
      const platformNames = form.platforms.map(p => PLATFORM_CONFIG[p]?.label || p).join('、')
      const contentTypeName = selectedType?.label || '文案'
      const platformIds = form.platforms.join(',')
      
      // 构建提示词 - 生成爆款任务描述
      const prompt = `你是一位短视频/图文内容策划专家，擅长为达人博主打造各平台爆款内容。

请根据以下【任务信息】生成一份【任务描述】，用于指导达人创作：

**【任务标题】** ${form.title}
**【目标平台】** ${platformNames}（平台ID: ${platformIds}）
**【内容类型】** ${contentTypeName}
${form.description ? `**【补充说明】** ${form.description}` : ''}

**【输出格式】** 生成一份专业的任务描述，要求：

【1. 产品/主题核心卖点】
- 列出2-3个最具吸引力的卖点
- 用具体数字或对比突出优势

【2. 目标用户画像】
- 描述目标受众的特征和需求
- 明确用户的痛点和期待

【3. 爆款内容方向】（3个具体可执行的方案）
- 方案A：...
- 方案B：...
- 方案C：...

【4. 开头3秒钩子设计】
- 提供2个抓人眼球的开头方式
- 运用悬念、冲突、数据等技巧

【5. 必须植入的关键词/话题】（5-8个热搜词）
- 贴合${platformNames}平台的热词

【6. 达人创作注意事项】
- 必须包含的内容点
- 禁止出现的内容/词汇

【7. 预期传播效果】
- 如：引发共鸣/促进互动/引导购买等

请生成专业、具体、可执行的任务描述，语言风格要符合达人博主的调性。`

      // 调用AI接口
      const res = await Network.request({
        url: '/api/ai/generate',
        method: 'POST',
        data: {
          prompt,
          platforms: form.platforms,
          contentType: form.contentType === 'text' ? 'copywriting' : form.contentType === 'video' ? 'video_script' : 'copywriting',
        },
      })

      console.log('[AI生成] 响应:', res.data)

      if (res.data.code === 200 && res.data.data?.content) {
        setForm(prev => ({ ...prev, description: res.data.data.content }))
        Taro.showToast({ title: 'AI帮写成功', icon: 'success' })
      } else {
        Taro.showToast({ title: 'AI帮写失败，请手动输入', icon: 'none' })
      }
    } catch (error) {
      console.error('[AI生成] 错误:', error)
      Taro.showToast({ title: 'AI帮写失败，请手动输入', icon: 'none' })
    } finally {
      setAiLoading(false)
    }
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
      // 清空已选平台的要求
      const newReqs = { ...prev.optionalRequirements }
      if (!platforms.includes(platformId)) {
        Object.keys(newReqs).forEach(key => {
          if (key.startsWith(platformId + '_')) {
            delete newReqs[key]
          }
        })
      }
      return { ...prev, platforms, optionalRequirements: newReqs }
    })
  }

  // 更新平台要求
  const handleRequirementChange = (platformId: string, reqId: string, value: string) => {
    setForm(prev => ({
      ...prev,
      optionalRequirements: {
        ...prev.optionalRequirements,
        [`${platformId}_${reqId}`]: value
      }
    }))
  }

  // 提交订单并跳转分身推荐
  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
      return
    }
    if (form.platforms.length === 0) {
      Taro.showToast({ title: '请选择发布平台', icon: 'none' })
      return
    }

    setIsSubmitting(true)

    try {
      // 先创建订单，获取订单ID
      const orderData = {
        title: form.title,
        description: form.description,
        content_type: form.contentType,
        platforms: form.platforms,
        avatar_count: form.avatarCount,
        quantity_per_avatar: form.quantityPerAvatar,
        total_price: totalPrice.total,
      }

      console.log('创建订单请求:', {
        url: '/api/order',
        method: 'POST',
        data: orderData
      })

      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: orderData,
      })

      console.log('创建订单响应:', res.data)

      if (res.data.code === 200 && res.data.data?.id) {
        const orderId = res.data.data.id
        
        console.log('[OrderCreate] 订单创建成功，订单ID:', orderId, '准备跳转')
        
        // 只带订单ID跳转，智能匹配页面会根据ID获取详情
        const targetUrl = `/pages/order/order-matching/index?orderId=${orderId}`
        console.log('[OrderCreate] 跳转URL:', targetUrl)
        
        // 跳转到AI智能匹配分身页面
        Taro.navigateTo({
          url: targetUrl
        })
      } else {
        Taro.showToast({ 
          title: res.data.msg || '创建订单失败', 
          icon: 'none' 
        })
      }
    } catch (err: any) {
      console.error('创建订单失败:', err)
      Taro.showToast({ 
        title: err?.message || '网络错误，请重试', 
        icon: 'none' 
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // 获取选中平台的特殊要求
  const getSelectedPlatformReqs = () => {
    return form.platforms.map(platformId => ({
      platformId,
      platform: PLATFORM_CONFIG[platformId],
      requirements: PLATFORM_CONFIG[platformId]?.requirements || []
    }))
  }

  return (
    <View className="order-create-page">
      {/* 顶部导航 */}
      <View className="top-nav">
        <View className="nav-left" onClick={() => Taro.navigateBack()}>
          <ChevronLeft size={24} color="#333" />
        </View>
        <Text className="nav-title">新建订单</Text>
        <View 
          className="nav-right" 
          onClick={() => Taro.navigateTo({ url: '/pages/order/order-create/index' })}
        >
          <FileText size={20} color="#1890ff" />
          <Text className="nav-text">发单记录</Text>
        </View>
      </View>
      
      <ScrollView scrollY className="scroll-container">
        {/* 任务标题 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">任务标题</Text>
            <Text className="section-tag">必填</Text>
          </View>
          <View className="input-wrapper">
            <Input
              className="title-input"
              placeholder="简洁明确的任务主题，如：新品发布推广"
              value={form.title}
              onInput={e => setForm(prev => ({ ...prev, title: e.detail.value }))}
              maxlength={50}
            />
          </View>
        </View>

        {/* 发布平台 - 放到前面 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">发布平台</Text>
            <Text className="section-tag">必填</Text>
          </View>
          <View className="platform-grid">
            {Object.entries(PLATFORM_CONFIG).map(([id, config]) => (
              <View
                key={id}
                className={`platform-card ${form.platforms.includes(id) ? 'active' : ''}`}
                onClick={() => handlePlatformToggle(id)}
              >
                <View className="platform-icon" style={{ background: config.color + '20' }}>
                  <Text className="platform-emoji">{config.icon}</Text>
                </View>
                <Text className="platform-name">{config.label}</Text>
                {form.platforms.includes(id) && (
                  <View className="platform-check">
                    <Check size={12} color="#fff" />
                  </View>
                )}
              </View>
            ))}
          </View>
          
          {/* 平台可选要求 */}
          {form.platforms.length > 0 && (
            <View className="platform-requirements">
              <View className="req-header" onClick={() => setShowPlatformReq(!showPlatformReq)}>
                <Text className="req-title">平台要求（可选）</Text>
                <ChevronRight size={16} color="#666" className={`req-arrow ${showPlatformReq ? 'open' : ''}`} />
              </View>
              {showPlatformReq && (
                <View className="req-content">
                  {getSelectedPlatformReqs().map(({ platformId, platform, requirements }) => (
                    <View key={platformId} className="platform-req-section">
                      <Text className="platform-req-title">{platform?.icon} {platform?.label} 要求</Text>
                      {requirements.map(req => (
                        <View key={req.id} className="req-item">
                          <Text className="req-label">{req.label}</Text>
                          <Input
                            className="req-input"
                            placeholder={req.placeholder}
                            value={form.optionalRequirements[`${platformId}_${req.id}`] || ''}
                            onInput={e => handleRequirementChange(platformId, req.id, e.detail.value)}
                          />
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* 内容类型 - 放到前面 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">内容类型</Text>
            <Text className="section-tag">必填</Text>
          </View>
          <View className="type-grid">
            {CONTENT_TYPES.map(type => (
              <View
                key={type.id}
                className={`type-card ${form.contentType === type.id ? 'active' : ''}`}
                onClick={() => handleTypeChange(type.id)}
              >
                <Text className="type-icon">{type.icon}</Text>
                <Text className="type-label">{type.label}</Text>
                <Text className="type-price">¥{type.price}/个</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 任务描述 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">任务描述</Text>
            <View className="ai-button" onClick={handleAIGenerate}>
              {aiLoading ? (
                <Loader size={14} color="#fff" className="ai-loading" />
              ) : (
                <Sparkles size={14} color="#fff" />
              )}
              <Text className="ai-text">AI帮写</Text>
            </View>
          </View>
          <View className="textarea-wrapper">
            <Textarea
              className="desc-textarea"
              style={{ height: '240px' }}
              placeholder="详细描述任务要求，如：产品特点、推广重点、禁忌词等..."
              value={form.description}
              onInput={e => setForm(prev => ({ ...prev, description: e.detail.value }))}
              maxlength={2000}
            />
          </View>
          <Text className="char-count">{form.description.length}/2000</Text>
        </View>

        {/* 分身数量 */}
        <View className="section">
          <View className="section-header">
            <Text className="section-title">分身设置</Text>
          </View>
          <View className="counter-row">
            <View className="counter-item">
              <Text className="counter-label">使用分身数</Text>
              <View className="counter-control">
                <View
                  className="counter-btn minus"
                  onClick={() => setForm(prev => ({ ...prev, avatarCount: Math.max(1, prev.avatarCount - 1) }))}
                >
                  <Text>-</Text>
                </View>
                <Text className="counter-value">{form.avatarCount}</Text>
                <View
                  className="counter-btn plus"
                  onClick={() => setForm(prev => ({ ...prev, avatarCount: prev.avatarCount + 1 }))}
                >
                  <Text>+</Text>
                </View>
              </View>
            </View>
            <View className="counter-item">
              <Text className="counter-label">每个分身产出</Text>
              <View className="counter-control">
                <View
                  className="counter-btn minus"
                  onClick={() => setForm(prev => ({ ...prev, quantityPerAvatar: Math.max(1, prev.quantityPerAvatar - 1) }))}
                >
                  <Text>-</Text>
                </View>
                <Text className="counter-value">{form.quantityPerAvatar}</Text>
                <View
                  className="counter-btn plus"
                  onClick={() => setForm(prev => ({ ...prev, quantityPerAvatar: prev.quantityPerAvatar + 1 }))}
                >
                  <Text>+</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* 价格预览 */}
        <View className="price-preview">
          <View className="price-row">
            <Text className="price-label">基础费用</Text>
            <Text className="price-value">¥{totalPrice.base}</Text>
          </View>
          <View className="price-row">
            <Text className="price-label">
              内容费用 ({selectedType?.label} × {form.quantityPerAvatar} × {form.avatarCount})
            </Text>
            <Text className="price-value">¥{totalPrice.content}</Text>
          </View>
          <View className="price-divider" />
          <View className="price-row total">
            <Text className="price-label">预计总价</Text>
            <Text className="price-value">¥{totalPrice.total}</Text>
          </View>
        </View>

        {/* 提交按钮 */}
        <View className="submit-section">
          <View
            className={`submit-button ${isSubmitting ? 'loading' : ''}`}
            onClick={isSubmitting || aiLoading ? undefined : handleSubmit}
          >
            {isSubmitting ? (
              <Loader size={20} color="#fff" className="btn-loading" />
            ) : (
              <>
                <Send size={18} color="#fff" />
                <Text className="submit-text">发布任务</Text>
              </>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  )
}
