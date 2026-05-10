import { useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, ScrollView } from '@tarojs/components'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, Send, Check, ChevronRight, Loader } from 'lucide-react-taro'
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
  const [loading, setLoading] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
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
      
      // 构建提示词 - 生成爆款任务描述
      const prompt = `你是抖音/小红书/快手等平台的专业内容策划师，擅长打造爆款内容。请根据以下任务信息，生成一份【任务描述】，用于给达人/博主明确的创作指引。

【任务主题】
${form.title}

【内容类型】
${contentTypeName}

【目标平台】
${platformNames}

${form.description ? `【品牌/产品补充信息】\n${form.description}\n` : ''}

【输出要求】
请按以下格式生成任务描述，每部分都要写清楚：

1. 【产品亮点】（2-3个）：用数字、对比、场景化方式突出卖点
2. 【用户痛点】：描述目标用户的需求和痛点，让博主能感同身受
3. 【内容方向】（2-3个）：具体可执行的内容方向，如"测评对比"、"场景种草"、"避坑指南"等
4. 【爆款钩子】（1-2个）：开头3秒抓人眼球的方法，如疑问句、冲突对比、惊人数据等
5. 【必须植入的关键词】：至少5个热搜词/话题标签
6. 【禁忌事项】：避免提到的内容或词语
7. 【预期效果】：如"引发共鸣"、"促进讨论"、"引导购买"等

风格要求：
- 语言专业但易懂，方便博主理解和执行
- 突出平台的爆款逻辑和流量密码
- 每条都要具体可执行，不要空话套话

请直接输出任务描述内容，不要有其他解释。`

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

  // 提交订单
  const handleSubmit = async () => {
    if (!form.title.trim()) {
      Taro.showToast({ title: '请输入任务标题', icon: 'none' })
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
          requirements: form.optionalRequirements,
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
    } catch (error) {
      console.error('[提交订单] 错误:', error)
      Taro.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      setLoading(false)
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
              placeholder="详细描述任务要求，如：产品特点、推广重点、禁忌词等..."
              value={form.description}
              onInput={e => setForm(prev => ({ ...prev, description: e.detail.value }))}
              maxlength={2000}
              autoHeight
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
            className={`submit-button ${loading ? 'loading' : ''}`}
            onClick={loading ? undefined : handleSubmit}
          >
            {loading ? (
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
