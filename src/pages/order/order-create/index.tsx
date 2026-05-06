import Taro, { navigateBack, showToast, navigateTo, useLoad, getLocation, requestPayment } from '@tarojs/taro'
import { useState, useMemo } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Input as BaseInput } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import * as Network from '@/network'
import { useUserStore } from '@/stores/user'
import {
  Briefcase, DollarSign, Target, Sparkles, Users, ArrowLeft, Image,
  Video, FileText, Calculator, TrendingUp, Zap, Check, Calendar as CalendarIcon,
  X, Loader
} from 'lucide-react-taro'
import './index.css'

interface OrderForm {
  title: string
  description: string
  budget: number  // 订单预算
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

interface Attachment {
  id: string
  name: string
  url: string
  type: 'image' | 'video' | 'document' | 'file'
}

// 价格配置（可调整）
const PRICE_CONFIG = {
  avatarBase: 5,      // 分身基础费用（元/个）
  image: 0.5,         // 图片（元/张）
  video: 30,          // 视频（元/个）
  article: 3          // 图文（元/篇）
}

// 计算默认截止日期（当前月份的下一个月）
const getDefaultDeadline = (): string => {
  const now = new Date()
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
  const year = nextMonth.getFullYear()
  const month = String(nextMonth.getMonth() + 1).padStart(2, '0')
  const day = String(nextMonth.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function OrderCreatePage() {
  const [loading, setLoading] = useState(false)
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [aiWriting, setAiWriting] = useState(false) // AI帮写状态
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null) // 编辑订单ID
  const [isCopyMode, setIsCopyMode] = useState(false) // 是否是复制模式

  const [form, setForm] = useState<OrderForm>({
    title: '',
    description: '',
    budget: 0,
    avatarCount: 1,
    quantityPerAvatar: 1,
    requirements: {
      contentType: 'article',
      platforms: [],
      targetAudience: '',
      expectedResults: '',
      deadline: getDefaultDeadline()
    }
  })

  const { userInfo } = useUserStore()
  const [statusBarHeight, setStatusBarHeight] = useState(20)

  useLoad(() => {
    const systemInfo = Taro.getSystemInfoSync()
    setStatusBarHeight(systemInfo.statusBarHeight || 20)
    
    // 获取 URL 参数
    const router = Taro.getCurrentInstance().router
    const params = router?.params || {}
    
    console.log('[OrderCreate] URL params:', params)
    console.log('[OrderCreate] Full URL:', router?.path)
    
    // 复制订单模式 - 优先检查 copy 参数
    if (params.copy) {
      console.log('[OrderCreate] 复制订单模式, orderId:', params.copy)
      setIsCopyMode(true)
      loadOrderData(params.copy)
    }
    // 编辑订单模式 - 检查 edit 参数
    else if (params.edit) {
      console.log('[OrderCreate] 编辑订单模式, orderId:', params.edit)
      setEditingOrderId(params.edit)
      loadOrderData(params.edit)
    }
  })
  
  // 加载订单数据
  const loadOrderData = async (orderId: string) => {
    try {
      setLoading(true)
      const res = await Network.request({
        url: `/api/order/${orderId}`,
        method: 'GET'
      })
      
      if (res.data?.code === 200 && res.data?.data) {
        const orderData = res.data.data
        
        // 解析 requirements JSON
        let requirements = {
          contentType: 'article',
          platforms: [],
          targetAudience: '',
          expectedResults: '',
          deadline: getDefaultDeadline()
        }
        
        if (orderData.requirements) {
          try {
            requirements = typeof orderData.requirements === 'string' 
              ? JSON.parse(orderData.requirements) 
              : orderData.requirements
          } catch (e) {
            console.error('[OrderCreate] 解析 requirements 失败:', e)
          }
        }
        
        // 设置表单数据
        setForm({
          title: orderData.title || '',
          description: orderData.description || '',
          budget: parseFloat(orderData.budget) || 0,
          avatarCount: orderData.avatar_count || orderData.avatarCount || 1,
          quantityPerAvatar: orderData.quantity_per_avatar || orderData.quantityPerAvatar || 1,
          requirements: {
            contentType: requirements.contentType || 'article',
            platforms: requirements.platforms || [],
            targetAudience: requirements.targetAudience || '',
            expectedResults: requirements.expectedResults || '',
            deadline: requirements.deadline || getDefaultDeadline()
          }
        })
        
        // 解析附件
        if (orderData.attachments) {
          try {
            const attachmentsData = typeof orderData.attachments === 'string'
              ? JSON.parse(orderData.attachments)
              : orderData.attachments
            if (Array.isArray(attachmentsData)) {
              setAttachments(attachmentsData.map((att: any, index: number) => ({
                id: `loaded-${index}`,
                name: att.name || att.url?.split('/').pop() || '附件',
                url: att.url,
                type: att.type || 'file'
              })))
            }
          } catch (e) {
            console.error('[OrderCreate] 解析 attachments 失败:', e)
          }
        }
        
        console.log('[OrderCreate] 订单数据加载成功:', orderData.title)
      } else {
        showToast({ title: '加载订单失败', icon: 'none' })
      }
    } catch (error) {
      console.error('[OrderCreate] 加载订单失败:', error)
      showToast({ title: '加载订单失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  // 生成日期选择器的数据
  const dateRange = useMemo(() => {
    const years: number[] = []
    const months: number[] = []
    const days: number[] = []
    const currentYear = new Date().getFullYear()

    for (let i = currentYear; i <= currentYear + 2; i++) {
      years.push(i)
    }

    for (let i = 1; i <= 12; i++) {
      months.push(i)
    }

    for (let i = 1; i <= 31; i++) {
      days.push(i)
    }

    return { years, months, days }
  }, [])

  const [datePickerValue, setDatePickerValue] = useState([0, 0, 0])

  const handleDateChange = (e: any) => {
    setDatePickerValue(e.detail.value)
  }

  const handleDateConfirm = () => {
    const { years, months, days } = dateRange
    const year = years[datePickerValue[0]]
    const month = String(months[datePickerValue[1]]).padStart(2, '0')
    const day = String(days[datePickerValue[2]]).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`

    // 检查是否选择了过去的日期
    const selectedDate = new Date(dateStr)
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (selectedDate < today) {
      showToast({ title: '不能选择过去的日期', icon: 'none' })
      return
    }

    setForm(prev => ({
      ...prev,
      requirements: { ...prev.requirements, deadline: dateStr }
    }))
    setShowDatePicker(false)
  }

  // 选择图片 - 暂时禁用
  // const handleChooseImage = async () => {
  //   try {
  //     const res = await chooseImage({
  //       count: 9 - attachments.length,
  //       sizeType: ['compressed'],
  //       sourceType: ['album', 'camera']
  //     })
  //
  //     if (res.tempFilePaths && res.tempFilePaths.length > 0) {
  //       // 上传图片
  //       await uploadFiles(res.tempFilePaths.map((path) => ({
  //         path,
  //         type: 'image' as const,
  //         name: `图片_${Date.now()}.jpg`
  //       })))
  //     }
  //   } catch (error) {
  //     console.error('选择图片失败:', error)
  //     showToast({ title: '选择图片失败', icon: 'none' })
  //   }
  // }

  // 选择视频 - 暂时禁用
  // const handleChooseVideo = async () => {
  //   try {
  //     const res = await chooseVideo({
  //       sourceType: ['album', 'camera'],
  //       maxDuration: 300 // 5分钟
  //     })
  //
  //     if (res.tempFilePath) {
  //       // 上传视频
  //       await uploadFiles([{
  //         path: res.tempFilePath,
  //         type: 'video' as const,
  //         name: `视频_${Date.now()}.mp4`
  //       }])
  //     }
  //   } catch (error) {
  //     console.error('选择视频失败:', error)
  //     showToast({ title: '选择视频失败', icon: 'none' })
  //   }
  // }

  // 选择文档 - 暂时禁用
  // const handleChooseDocument = async () => {
  //   try {
  //     const res = await chooseMessageFile({
  //       count: 9 - attachments.length,
  //       type: 'file',
  //       extension: ['doc', 'docx', 'pdf']
  //     })
  //
  //     if (res.tempFiles && res.tempFiles.length > 0) {
  //       // 上传文档
  //       await uploadFiles(res.tempFiles.map((file) => ({
  //         path: file.path,
  //         type: 'document' as const,
  //         name: file.name
  //       })))
  //     }
  //   } catch (error) {
  //     console.error('选择文档失败:', error)
  //     showToast({ title: '选择文档失败', icon: 'none' })
  //   }
  // }

  // AI帮写需求描述
  const handleAiWrite = async () => {
    if (!form.title.trim()) {
      showToast({ title: '请先填写订单标题', icon: 'none' })
      return
    }

    if (form.requirements.platforms.length === 0) {
      showToast({ title: '请先选择发布平台', icon: 'none' })
      return
    }

    setAiWriting(true)

    try {
      // 获取选中的平台名称
      const selectedPlatformNames = form.requirements.platforms
        .map(p => platforms.find(platform => platform.value === p)?.label)
        .filter(Boolean)
        .join('、')

      // 获取内容类型名称
      const selectedContentType = contentTypes.find(t => t.value === form.requirements.contentType)
      const contentTypeName = selectedContentType?.label || '图文'

      // 构建平台特定的提示词
      let platformPrompt = ''
      if (form.requirements.platforms.includes('xiaohongshu')) {
        platformPrompt = `针对小红书平台：注意风格要年轻化、生活化，多使用表情符号和话题标签，内容要有"种草"属性，注重真实体验分享。`
      } else if (form.requirements.platforms.includes('wechat_moments')) {
        platformPrompt = `针对朋友圈：风格要私密、温暖、有故事性，适合个人化表达，不做过分商业化包装，要能引发朋友互动。`
      } else if (form.requirements.platforms.includes('wechat_mp')) {
        platformPrompt = `针对公众号：内容要有深度、专业度，结构清晰、逻辑严密，适合长阅读，要有观点和洞察，注重知识传递。`
      } else if (form.requirements.platforms.includes('douyin')) {
        platformPrompt = `针对抖音平台：内容要节奏明快、有视觉冲击力，脚本要有悬念和反转，3-5秒内要抓住注意力，注重娱乐性和传播性。`
      }

      // 构建内容类型特定的提示词
      let contentTypePrompt = ''
      if (form.requirements.contentType === 'image') {
        contentTypePrompt = `针对图片内容：注重视觉表现力，画面要精美、有质感，构图要吸引人，色调要和谐。内容要有故事性或情感共鸣，让用户一看就有兴趣。适合用于种草、展示产品、生活方式等场景。`
      } else if (form.requirements.contentType === 'video') {
        contentTypePrompt = `针对视频内容：注重脚本策划、画面表现、节奏把控。要有完整的故事结构（开头、发展、高潮、结尾），画面切换流畅，音乐配乐合适。时长控制在15-60秒最佳，要能在短时间内传递有效信息。`
      } else if (form.requirements.contentType === 'article') {
        contentTypePrompt = `针对图文内容：注重文字表达和逻辑结构。标题要吸引人，开头要有钩子，正文要有层次感，结尾要有行动号召。内容要有价值、有深度，能让用户有所收获。适合用于知识分享、观点表达、品牌故事等。`
      }

      const prompt = `请根据以下订单标题、发布平台和内容类型，生成一份详细的需求描述。

发布平台：${selectedPlatformNames}
内容类型：${contentTypeName}
${platformPrompt}
${contentTypePrompt}

要求：
1. 必须包含以下五个方面：内容方向、风格要求、受众目标、品牌调性、预期效果
2. 内容方向：明确说明要创作的内容类型和方向，结合内容类型特点进行描述
3. 风格要求：描述内容的风格特点、语言风格、表现形式等，符合平台调性
4. 受众目标：明确目标用户群体画像和特征
5. 品牌调性：描述品牌形象、价值观、传达的情感
6. 预期效果：说明希望达到的量化指标和影响，适合平台传播
7. 每个方面2-3句话，详细且具体，并针对所选平台和内容类型特点进行优化
8. 字数控制在200-350字之间

订单标题：${form.title}

请直接生成需求描述内容，格式清晰，用简洁的分段或标点分隔各个方面：`

      const res = await Network.request({
        url: '/api/chat/generate',
        method: 'POST',
        data: {
          prompt
        }
      })

      console.log('[AI帮写] 响应数据:', res.data)

      if (res.data && res.data.data && res.data.data.content) {
        const aiDescription = res.data.data.content
        setForm(prev => ({
          ...prev,
          description: aiDescription.trim()
        }))
        showToast({ title: 'AI帮写完成', icon: 'success' })
      } else {
        throw new Error('AI响应格式错误')
      }
    } catch (error) {
      console.error('AI帮写失败:', error)
      showToast({ title: 'AI帮写失败，请重试', icon: 'none' })
    } finally {
      setAiWriting(false)
    }
  }

  // 上传文件 - 暂时禁用
  // const uploadFiles = async (files: Array<{ path: string; type: 'image' | 'video' | 'document'; name: string }>) => {
  //   setUploading(true)
  //   try {
  //     const uploadPromises = files.map(async (file) => {
  //       const uploadRes = await Network.uploadFile({
  //         url: '/api/upload/image',
  //         filePath: file.path,
  //         name: 'file'
  //       })
  //
  //       // 解析响应数据（uploadRes.data 可能是字符串或对象）
  //       let data
  //       try {
  //         data = typeof uploadRes.data === 'string'
  //           ? JSON.parse(uploadRes.data)
  //           : uploadRes.data
  //       } catch (parseError) {
  //         console.error('解析上传响应失败:', parseError, uploadRes)
  //         throw new Error('服务器返回数据格式错误')
  //       }
  //
  //       if (data.code === 200) {
  //         return {
  //           id: Date.now().toString() + Math.random(),
  //           name: file.name,
  //           url: data.data.url,
  //           type: file.type
  //         }
  //       }
  //       throw new Error(data.message || '上传失败')
  //     })
  //
  //     const uploadedFiles = await Promise.all(uploadPromises)
  //     setAttachments(prev => [...prev, ...uploadedFiles])
  //     showToast({ title: '上传成功', icon: 'success' })
  //   } catch (error) {
  //     console.error('上传失败:', error)
  //     showToast({ title: '上传失败', icon: 'none' })
  //   } finally {
  //     setUploading(false)
  //   }
  // }

  // 删除附件
  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(att => att.id !== id))
  }

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
    { value: 'video', label: '视频', icon: Video, color: '#ec4899' }
  ]

  const platforms = [
    { value: 'wechat_moments', label: '朋友圈' },
    { value: 'wechat_mp', label: '公众号' },
    { value: 'xiaohongshu', label: '小红书' },
    { value: 'douyin', label: '抖音' }
  ]

  const togglePlatform = (platform: string) => {
    setForm(prev => {
      const currentPlatforms = prev.requirements.platforms

      // 切换平台选中状态
      const newPlatforms = currentPlatforms.includes(platform)
        ? currentPlatforms.filter(p => p !== platform)
        : [...currentPlatforms, platform]

      return {
        ...prev,
        requirements: {
          ...prev.requirements,
          platforms: newPlatforms
        }
      }
    })
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
          is_paid: true, // 立即支付
          content_type: form.requirements.contentType,
          platforms: form.requirements.platforms,
          target_audience: form.requirements.targetAudience,
          deadline: form.requirements.deadline || null,
          expected_quantity: form.avatarCount,
          content_config: {
            quantity_per_avatar: form.quantityPerAvatar
          },
          attachments: attachments.map(att => ({
            url: att.url,
            type: att.type,
            name: att.name
          })),
          ...locationData
        }
      })

      if (res.data?.code === 200) {
        const orderId = res.data.data?.id

        // 调用真实支付接口
        try {
          // 检查用户是否登录
          if (!userInfo) {
            showToast({ title: '请先登录', icon: 'none' })
            setLoading(false)
            return
          }

          // 从用户信息获取 openid（如果有的话）
          const openid = userInfo.openid || Taro.getStorageSync('openid') || ''

          // 检测当前环境
          const env = Taro.getEnv()
          const isWeapp = env === Taro.ENV_TYPE.WEAPP

          const payRes = await Network.request({
            url: '/api/payment/wechat/create-order-payment',
            method: 'POST',
            data: {
              orderId,
              amount: totalPrice.total,
              description: `订单支付-${form.title}`,
              openid,
              platform: isWeapp ? 'miniprogram' : 'h5'
            }
          })

          if (payRes.data?.code === 200) {
            const payParams = payRes.data.data

            // 根据平台使用不同的支付方式
            if (isWeapp) {
              // 小程序端：使用真实的小程序支付
              console.log('[OrderCreate] 拉起小程序支付，参数:', payParams)

              await requestPayment({
                timeStamp: payParams.timeStamp,
                nonceStr: payParams.nonceStr,
                package: payParams.package,
                signType: payParams.signType,
                paySign: payParams.paySign
              })

              console.log('[OrderCreate] 小程序支付成功')
              showToast({ title: '支付成功', icon: 'success' })
              setTimeout(() => {
                navigateTo({
                  url: `/pages/order/order-matching/index?orderId=${orderId}`
                })
              }, 1500)
            } else {
              // H5端：跳转到微信H5支付页面
              console.log('[OrderCreate] 跳转H5支付，mweb_url:', payParams.mweb_url)

              if (payParams.mweb_url) {
                // 保存订单ID用于支付回调
                Taro.setStorageSync('pending_order_id', orderId)

                // 使用 Taro 的方式跳转，避免 window is not defined 错误
                try {
                  Taro.setStorageSync('payment_redirect_url', payParams.mweb_url)
                  // H5 端，检查 window 是否存在
                  if (typeof window !== 'undefined' && window.location) {
                    window.location.href = payParams.mweb_url
                  } else {
                    showToast({ title: '支付页面加载失败', icon: 'none' })
                    setLoading(false)
                  }
                } catch (err) {
                  console.error('[OrderCreate] 跳转支付失败:', err)
                  showToast({ title: '支付页面跳转失败', icon: 'none' })
                  setLoading(false)
                }
              } else {
                showToast({ title: '支付参数错误', icon: 'none' })
                setLoading(false)
              }
            }
          } else {
            showToast({ title: payRes.data?.message || '创建支付订单失败', icon: 'none' })
            setLoading(false)
            // 支付订单创建失败，询问是否取消订单
            setTimeout(() => {
              Taro.showModal({
                title: '提示',
                content: '支付订单创建失败，是否取消当前订单？',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    // 取消订单
                    Network.request({
                      url: `/api/order/${orderId}/cancel`,
                      method: 'PUT'
                    }).then(() => {
                      showToast({ title: '订单已取消', icon: 'success' })
                      navigateBack()
                    }).catch(() => {
                      showToast({ title: '取消订单失败', icon: 'none' })
                    })
                  }
                }
              })
            }, 1000)
          }
        } catch (payError: any) {
          console.error('[OrderCreate] 支付失败:', payError)

          // 如果是用户取消支付，给出提示
          if (payError.errMsg && payError.errMsg.includes('cancel')) {
            showToast({ title: '您已取消支付', icon: 'none' })
          } else if (payError.message && payError.message.includes('window is not defined')) {
            showToast({ title: '支付环境异常，请重试', icon: 'none' })
          } else {
            showToast({ title: payError.message || '支付失败，请重试', icon: 'none' })
          }

          setLoading(false)

          // 支付失败/取消，询问用户是否取消订单
          setTimeout(() => {
            Taro.showModal({
              title: '提示',
              content: '支付失败或已取消，是否取消当前订单？',
              confirmText: '取消订单',
              cancelText: '重新支付',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  // 取消订单
                  Network.request({
                    url: `/api/order/${orderId}/cancel`,
                    method: 'PUT'
                  }).then(() => {
                    showToast({ title: '订单已取消', icon: 'success' })
                    navigateBack()
                  }).catch(() => {
                    showToast({ title: '取消订单失败', icon: 'none' })
                  })
                } else if (modalRes.cancel) {
                  // 重新支付，不退出
                  showToast({ title: '请重新点击支付按钮', icon: 'none' })
                }
              }
            })
          }, 1000)
        }
      } else {
        showToast({ title: res.data?.message || '发布失败', icon: 'none' })
        setLoading(false)
      }
    } catch (error) {
      console.error('[OrderCreate] 发布订单失败:', error)
      showToast({ title: '发布失败', icon: 'none' })
      setLoading(false)
    }
  }

  // 暂不支付，直接创建订单并跳转到分身匹配页面
  const handleNoPay = async () => {
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

      // 创建订单，暂不支付但保留预算，后端会设置 status 为 'open' 并标记 is_paid 为 false
      const res = await Network.request({
        url: '/api/order',
        method: 'POST',
        data: {
          title: form.title,
          description: form.description,
          budget: totalPrice.total, // 使用计算后的总价
          is_paid: false, // 暂不支付
          content_type: form.requirements.contentType,
          platforms: form.requirements.platforms,
          target_audience: form.requirements.targetAudience,
          deadline: form.requirements.deadline || null,
          expected_quantity: form.avatarCount,
          content_config: {
            quantity_per_avatar: form.quantityPerAvatar
          },
          attachments: attachments.map(att => ({
            url: att.url,
            type: att.type,
            name: att.name
          })),
          ...locationData
        }
      })

      if (res.data?.code === 200) {
        const orderId = res.data.data?.id
        showToast({ title: '订单创建成功', icon: 'success' })
        setLoading(false)

        // 跳转到分身匹配页面
        setTimeout(() => {
          navigateTo({
            url: `/pages/order/order-matching/index?orderId=${orderId}`
          })
        }, 500)
      } else {
        showToast({ title: res.data?.message || '创建订单失败', icon: 'none' })
        setLoading(false)
      }
    } catch (error) {
      console.error('[OrderCreate] 创建订单失败:', error)
      showToast({ title: '创建订单失败', icon: 'none' })
      setLoading(false)
    }
  }

  const selectedType = contentTypes.find(t => t.value === form.requirements.contentType)
  const contentPricePerUnit = selectedType
    ? (form.requirements.contentType === 'image' ? PRICE_CONFIG.image :
       form.requirements.contentType === 'video' ? PRICE_CONFIG.video :
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
          <Text className="nav-title">
            {isCopyMode ? '复制订单' : editingOrderId ? '编辑订单' : '发布订单'}
          </Text>
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

        {/* 描述输入 */}
        <View className="section-card">
          <View className="card-header">
            <Briefcase size={20} color="#3b82f6" />
            <Text className="card-title">需求描述</Text>
            <View className="ai-write-btn" onClick={handleAiWrite}>
              {aiWriting ? (
                <>
                  <Loader size={16} color="#8b5cf6" className="animate-spin" />
                  <Text className="ai-btn-text block">AI生成中...</Text>
                </>
              ) : (
                <>
                  <Sparkles size={16} color="#8b5cf6" />
                  <Text className="ai-btn-text block">AI帮写</Text>
                </>
              )}
            </View>
          </View>
          <Textarea
            className="desc-textarea"
            placeholder="详细描述您的营销需求，包括内容方向、风格要求、品牌调性等..."
            value={form.description}
            onInput={(e: any) => setForm({ ...form, description: e.detail.value })}
            maxlength={500}
            placeholderClass="textarea-placeholder"
            autoHeight
          />
          <Text className="char-count">{form.description.length}/500</Text>

          {/* 附件上传 - 暂时禁用 */}
          <View className="attachment-section" style={{ opacity: 0.5 }}>
            <Text className="attachment-title">添加附件</Text>
            <Text className="text-gray-500 text-sm">（暂不支持）</Text>

            {/* 上传按钮 */}
            <View className="upload-buttons">
              <Button
                className="upload-btn disabled"
                disabled
                size="sm"
              >
                <Image size={16} color="#9ca3af" />
                <Text>图片</Text>
              </Button>
              <Button
                className="upload-btn disabled"
                disabled
                size="sm"
              >
                <Video size={16} color="#9ca3af" />
                <Text>视频</Text>
              </Button>
              <Button
                className="upload-btn disabled"
                disabled
                size="sm"
              >
                <FileText size={16} color="#9ca3af" />
                <Text>文档</Text>
              </Button>
            </View>

            {/* 附件列表 */}
            {attachments.length > 0 && (
              <View className="attachment-list">
                {attachments.map((att) => (
                  <View key={att.id} className="attachment-item">
                    <View className="attachment-icon">
                      {att.type === 'image' ? (
                        <Image size={24} color="#3b82f6" />
                      ) : att.type === 'video' ? (
                        <Video size={24} color="#ec4899" />
                      ) : (
                        <FileText size={24} color="#8b5cf6" />
                      )}
                    </View>
                    <Text className="attachment-name">{att.name}</Text>
                    <View className="attachment-remove" onClick={() => handleRemoveAttachment(att.id)}>
                      <X size={18} color="#ef4444" />
                    </View>
                  </View>
                ))}
              </View>
            )}
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
                style={{
                  width: '48px',
                  height: '32px',
                  fontSize: '20px',
                  fontWeight: '800',
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  border: 'none',
                  textAlign: 'center'
                }}
                value={form.avatarCount.toString()}
                onInput={(e: any) => {
                  const value = parseInt(e.detail.value) || 1
                  setForm(prev => ({ ...prev, avatarCount: Math.max(1, value) }))
                }}
              />
              <View
                className="counter-btn"
                onClick={() => setForm(prev => ({ ...prev, avatarCount: prev.avatarCount + 1 }))}
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
                style={{
                  width: '48px',
                  height: '32px',
                  fontSize: '20px',
                  fontWeight: '800',
                  color: '#000000',
                  backgroundColor: '#ffffff',
                  border: 'none',
                  textAlign: 'center'
                }}
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
            <View
              className="info-input date-input"
              onClick={() => setShowDatePicker(true)}
            >
              {form.requirements.deadline ? (
                <Text className="date-text">{form.requirements.deadline}</Text>
              ) : (
                <Text className="date-placeholder">选择截止日期</Text>
              )}
              <CalendarIcon size={18} color="#9ca3af" />
            </View>
          </View>
        </View>

        {/* 提交按钮 */}
        <View className="submit-section">
          <Button
            className={`submit-btn ${loading ? 'loading' : ''}`}
            onClick={handleNoPay}
            disabled={loading}
            style={{ marginBottom: '12px' }}
          >
            {loading ? (
              <Text className="btn-text">创建中...</Text>
            ) : (
              <>
                <Zap size={18} color="#fff" />
                <Text className="btn-text">暂不支付</Text>
              </>
            )}
          </Button>
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

      {/* 日期选择器弹窗 */}
      {showDatePicker && (
        <View className="date-picker-modal">
          <View className="date-picker-content">
            <View className="date-picker-header">
              <Text className="date-picker-title">选择截止日期</Text>
              <View className="date-picker-close" onClick={() => setShowDatePicker(false)}>
                <Text>取消</Text>
              </View>
            </View>
            <View className="date-picker-body">
              <Picker
                mode="selector"
                range={dateRange.years.map(y => `${y}年`)}
                value={datePickerValue[0]}
                onChange={(e: any) => {
                  const newValue = [...datePickerValue]
                  newValue[0] = e.detail.value
                  setDatePickerValue(newValue)
                }}
              >
                <View className="picker-item">
                  <Text className="picker-text">{dateRange.years[datePickerValue[0]]}年</Text>
                </View>
              </Picker>
              <Picker
                mode="selector"
                range={dateRange.months.map(m => `${m}月`)}
                value={datePickerValue[1]}
                onChange={(e: any) => {
                  const newValue = [...datePickerValue]
                  newValue[1] = e.detail.value
                  setDatePickerValue(newValue)
                }}
              >
                <View className="picker-item">
                  <Text className="picker-text">{dateRange.months[datePickerValue[1]]}月</Text>
                </View>
              </Picker>
              <Picker
                mode="selector"
                range={dateRange.days.map(d => `${d}日`)}
                value={datePickerValue[2]}
                onChange={handleDateChange}
              >
                <View className="picker-item">
                  <Text className="picker-text">{dateRange.days[datePickerValue[2]]}日</Text>
                </View>
              </Picker>
            </View>
            <View className="date-picker-footer">
              <Button
                className="date-picker-confirm"
                onClick={handleDateConfirm}
              >
                <Text>确定</Text>
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}
