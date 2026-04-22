import { useState } from 'react'
import { View, Text, Image, Video, ScrollView } from '@tarojs/components'
import Taro, { useLoad, useRouter, navigateTo } from '@tarojs/taro'
import * as Network from '@/network'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Upload, ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react-taro'
import MarkdownRender from '@/components/markdown-render'
import './index.scss'

const PLATFORM_NAMES: Record<string, string> = {
  wechat_mp: '微信公众号',
  wechat_channel: '视频号',
  weibo: '微博',
  xiaohongshu: '小红书',
  douyin: '抖音',
  zhihu: '知乎',
  bilibili: '哔哩哔哩',
  toutiao: '今日头条',
  other: '其他平台'
}

export default function OrderPublishFeedback() {
  const router = useRouter()
  const { requestId, orderId } = router.params

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [publishResults, setPublishResults] = useState<any[]>([])
  const [generatedContent, setGeneratedContent] = useState<any>(null)
  const [feedback, setFeedback] = useState<Record<string, { image: string; link: string; linkInfo?: any }>>({})
  const [contentExpanded, setContentExpanded] = useState(false) // 内容展开状态
  const [validatingLinks, setValidatingLinks] = useState<Record<string, boolean>>({}) // 验证中状态
  const [avatarId, setAvatarId] = useState<string>('') // 分身ID

  useLoad(() => {
    console.log('[OrderPublishFeedback] 页面加载，params:', { requestId, orderId })
    loadOrderData()
  })

  const loadOrderData = async () => {
    try {
      console.log('[OrderPublishFeedback] 开始加载订单数据')
      const response = await Network.request({
        url: `/api/order-processing/status/${requestId}`
      })

      console.log('[OrderPublishFeedback] 订单数据响应:', response.data)

      if (response.data?.code === 200) {
        const data = response.data.data
        
        // 提取 avatarId
        if (data.avatarId) {
          setAvatarId(data.avatarId)
        }
        
        setGeneratedContent(data.generatedContent)

        // 获取发布结果（兼容驼峰命名和下划线命名）
        const platforms = data.publishStatus?.platforms || data.publish_status?.platforms || []

        if (platforms.length > 0) {
          setPublishResults(platforms)
          console.log('[OrderPublishFeedback] 发布结果:', platforms)
        } else {
          // 如果没有发布结果，但有生成内容，说明是待发布状态
          if (data.generatedContent?.platforms) {
            // 根据生成内容的平台创建待发布的平台列表
            const pendingPlatforms = data.generatedContent.platforms.map((p: string) => ({
              platform: p,
              status: 'manual',
              message: '需要手动发布'
            }))
            setPublishResults(pendingPlatforms)
            console.log('[OrderPublishFeedback] 待发布平台:', pendingPlatforms)
          }
        }
      } else {
        Taro.showToast({
          title: response.data?.message || '加载失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderPublishFeedback] 加载订单数据失败:', error)
      Taro.showToast({
        title: '网络异常',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleChooseImage = (platform: string) => {
    console.log('[OrderPublishFeedback] ========== 点击上传截图 ==========')
    console.log('[OrderPublishFeedback] 平台:', platform)
    console.log('[OrderPublishFeedback] 当前反馈状态:', feedback)
    console.log('[OrderPublishFeedback] 当前环境:', Taro.getEnv())

    // 检查环境
    const env = Taro.getEnv()
    if (env === Taro.ENV_TYPE.WEB) {
      console.log('[OrderPublishFeedback] H5环境，使用文件选择器')
      // H5环境下使用文件选择器
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e: any) => {
        const file = e.target.files[0]
        if (file) {
          console.log('[OrderPublishFeedback] 选择文件成功:', file.name)
          console.log('[OrderPublishFeedback] 文件类型:', file.type)
          console.log('[OrderPublishFeedback] 文件大小:', file.size)
          
          try {
            // 使用FormData上传
            const formData = new FormData()
            formData.append('file', file)

            console.log('[OrderPublishFeedback] 开始上传到:', `${window.location.origin}/api/upload/image`)
            const response = await fetch(`${window.location.origin}/api/upload/image`, {
              method: 'POST',
              body: formData
            })

            console.log('[OrderPublishFeedback] 上传响应状态:', response.status)
            const uploadData = await response.json()
            console.log('[OrderPublishFeedback] H5上传响应完整数据:', JSON.stringify(uploadData, null, 2))

            if (uploadData.code === 200 && uploadData.data?.url) {
              const imageUrl = uploadData.data.url
              console.log('[OrderPublishFeedback] 提取到图片URL:', imageUrl)
              console.log('[OrderPublishFeedback] 准备更新反馈状态:', { platform, imageUrl })
              
              setFeedback(prev => {
                const newState = {
                  ...prev,
                  [platform]: { ...(prev[platform] || {}), image: imageUrl }
                }
                console.log('[OrderPublishFeedback] 更新后的反馈状态:', newState)
                return newState
              })
              
              Taro.showToast({
                title: '上传成功',
                icon: 'success'
              })
            } else {
              console.error('[OrderPublishFeedback] H5上传失败:', uploadData)
              Taro.showToast({
                title: uploadData.message || '上传失败',
                icon: 'none'
              })
            }
          } catch (error) {
            console.error('[OrderPublishFeedback] H5上传失败:', error)
            Taro.showToast({
              title: '上传失败，请重试',
              icon: 'none'
            })
          }
        }
      }
      input.click()
      return
    }

    // 小程序环境
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        console.log('[OrderPublishFeedback] 选择图片:', tempFilePath)
        console.log('[OrderPublishFeedback] 图片信息:', res.tempFiles?.[0])

        try {
          // 上传图片到服务器
          console.log('[OrderPublishFeedback] 开始上传图片到服务器')
          const uploadRes = await Network.uploadFile({
            url: '/api/upload/image',
            filePath: tempFilePath,
            name: 'file'
          })

          console.log('[OrderPublishFeedback] 上传响应:', uploadRes)
          console.log('[OrderPublishFeedback] 上传响应类型:', typeof uploadRes.data)
          console.log('[OrderPublishFeedback] 上传响应内容:', uploadRes.data)

          // 解析响应数据（uploadRes.data 可能是字符串或对象）
          let uploadData
          try {
            // 如果 data 是字符串，需要 JSON.parse
            uploadData = typeof uploadRes.data === 'string'
              ? JSON.parse(uploadRes.data)
              : uploadRes.data
            console.log('[OrderPublishFeedback] 解析后的数据:', JSON.stringify(uploadData, null, 2))
          } catch (parseError) {
            console.error('[OrderPublishFeedback] 解析响应失败:', parseError)
            console.error('[OrderPublishFeedback] 原始响应:', uploadRes)
            throw new Error('服务器返回数据格式错误')
          }

          console.log('[OrderPublishFeedback] 解析后的数据:', uploadData)

          if (uploadData.code === 200 && uploadData.data?.url) {
            const imageUrl = uploadData.data.url
            console.log('[OrderPublishFeedback] 提取到图片URL:', imageUrl)
            console.log('[OrderPublishFeedback] URL类型:', typeof imageUrl)
            console.log('[OrderPublishFeedback] 准备更新反馈状态:', { platform, imageUrl })
            
            setFeedback(prev => {
              const newState = {
                ...prev,
                [platform]: { ...(prev[platform] || {}), image: imageUrl }
              }
              console.log('[OrderPublishFeedback] 更新后的反馈状态:', JSON.stringify(newState, null, 2))
              return newState
            })
            
            Taro.showToast({
              title: '上传成功',
              icon: 'success'
            })
          } else {
            console.error('[OrderPublishFeedback] 上传失败:', uploadData)
            console.error('[OrderPublishFeedback] uploadData.code:', uploadData.code)
            console.error('[OrderPublishFeedback] uploadData.data:', uploadData.data)
            Taro.showToast({
              title: uploadData.message || '上传失败',
              icon: 'none'
            })
          }
        } catch (error) {
          console.error('[OrderPublishFeedback] 上传图片失败:', error)
          Taro.showToast({
            title: '上传失败，请重试',
            icon: 'none'
          })
        }
      }
    })
  }

  const handleLinkChange = (platform: string, value: string) => {
    setFeedback(prev => ({
      ...prev,
      [platform]: { ...prev[platform], link: value }
    }))
  }

  // 验证链接
  const handleValidateLink = async (platform: string) => {
    const link = feedback[platform]?.link
    if (!link) {
      Taro.showToast({
        title: '请先输入发布链接',
        icon: 'none'
      })
      return
    }

    setValidatingLinks(prev => ({ ...prev, [platform]: true }))

    try {
      const res = await Network.request({
        url: '/api/order-processing/validate-link',
        method: 'POST',
        data: {
          url: link,
          orderId: orderId,
          avatarId: avatarId
        }
      })

      console.log('[OrderPublishFeedback] 验证链接响应:', res.data)

      if (res.data?.code === 200 && res.data?.data) {
        const result = res.data.data
        if (result.success && result.data) {
          setFeedback(prev => ({
            ...prev,
            [platform]: { ...prev[platform], linkInfo: result.data }
          }))
          Taro.showToast({
            title: `验证成功：${result.data.title}`,
            icon: 'success'
          })
        } else {
          Taro.showToast({
            title: result.error || '验证失败',
            icon: 'none'
          })
        }
      } else {
        Taro.showToast({
          title: '验证失败，请稍后重试',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderPublishFeedback] 验证链接失败:', error)
      Taro.showToast({
        title: '验证失败，请检查网络',
        icon: 'none'
      })
    } finally {
      setValidatingLinks(prev => ({ ...prev, [platform]: false }))
    }
  }

  const handleSubmit = async () => {
    // 验证是否填写了反馈
    const platforms = Object.keys(feedback)
    if (platforms.length === 0) {
      Taro.showToast({
        title: '请至少为一个平台填写反馈',
        icon: 'none'
      })
      return
    }

    // 验证每个平台至少填写一项
    const hasInvalid = platforms.some(platform => {
      const fb = feedback[platform]
      return !fb.image && !fb.link
    })

    if (hasInvalid) {
      Taro.showToast({
        title: '请填写截图或链接',
        icon: 'none'
      })
      return
    }

    setSubmitting(true)

    try {
      console.log('[OrderPublishFeedback] 开始提交反馈')
      const response = await Network.request({
        url: `/api/order-processing/feedback/${requestId}`,
        method: 'POST',
        data: {
          feedback
        }
      })

      console.log('[OrderPublishFeedback] 提交反馈响应:', response.data)

      if (response.data?.code === 200) {
        Taro.showToast({
          title: '反馈成功',
          icon: 'success',
          duration: 2000
        })

        setTimeout(() => {
          navigateTo({
            url: `/pages/order-detail/index?id=${orderId}`
          })
        }, 2000)
      } else {
        Taro.showToast({
          title: response.data?.message || '提交失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('[OrderPublishFeedback] 提交反馈失败:', error)
      Taro.showToast({
        title: '网络异常，请重试',
        icon: 'none'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <View className="flex items-center justify-center h-full">
        <Text className="block text-gray-500">加载中...</Text>
      </View>
    )
  }

  return (
    <View className="order-publish-feedback-page bg-gray-50 min-h-screen" style={{ paddingBottom: '120px' }}>
      {/* 顶部导航 */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        <View onClick={() => Taro.navigateBack()} className="p-2 -ml-2">
          <ArrowLeft size={20} color="#666" />
        </View>
        <Text className="block flex-1 text-center text-lg font-semibold mr-6">
          反馈发布效果
        </Text>
      </View>

      <View className="p-4 space-y-4">
        {/* 订单信息卡片 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">订单信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {generatedContent && (
              <>
                <View className="flex justify-between">
                  <Text className="block text-gray-600 text-sm">标题</Text>
                  <Text className="block text-gray-900 text-sm font-medium">
                    {generatedContent.title}
                  </Text>
                </View>
                <View className="flex justify-between">
                  <Text className="block text-gray-600 text-sm">类型</Text>
                  <Text className="block text-gray-900 text-sm">
                    {generatedContent.platforms?.includes('video') ? '视频' : '文章'}
                  </Text>
                </View>
              </>
            )}
          </CardContent>
        </Card>

        {/* 生成内容卡片 */}
        {generatedContent && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">生成的内容</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setContentExpanded(!contentExpanded)}
                className="flex items-center gap-1"
              >
                {contentExpanded ? (
                  <>
                    <ChevronUp size={16} color="#6b7280" />
                    <Text className="text-xs">收起</Text>
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} color="#6b7280" />
                    <Text className="text-xs">展开</Text>
                  </>
                )}
              </Button>
            </CardHeader>
            <CardContent>
              {generatedContent.title && (
                <View className="mb-3">
                  <Text className="block text-gray-900 text-base font-semibold">
                    {generatedContent.title}
                  </Text>
                </View>
              )}

              {/* 图片展示 */}
              {generatedContent.images && generatedContent.images.length > 0 && (
                <View className="mb-3">
                  <Text className="block text-sm text-gray-600 mb-2">图片素材</Text>
                  <ScrollView scrollX className="flex flex-row gap-2">
                    {generatedContent.images.map((img: string, idx: number) => (
                      <Image
                        key={idx}
                        src={img}
                        className="h-24 w-24 rounded-lg flex-shrink-0"
                        mode="aspectFill"
                        onClick={() => {
                          Taro.previewImage({
                            current: img,
                            urls: generatedContent.images
                          })
                        }}
                      />
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* 视频展示 */}
              {generatedContent.videoUrl && (
                <View className="mb-3">
                  <Text className="block text-sm text-gray-600 mb-2">视频素材</Text>
                  <Video
                    src={generatedContent.videoUrl}
                    className="w-full rounded-lg"
                    controls
                  />
                </View>
              )}

              {/* 图文内容 - 支持折叠/展开 */}
              {generatedContent.content && (
                <View className="bg-gray-50 rounded-lg overflow-hidden">
                  {contentExpanded ? (
                    <View className="p-3">
                      <MarkdownRender content={generatedContent.content} />
                    </View>
                  ) : (
                    <View className="p-3">
                      <View className="markdown-content-collapsed overflow-hidden">
                        <MarkdownRender content={generatedContent.content} />
                      </View>
                      <View className="mt-2 pt-2 border-t border-gray-200">
                        <Text className="block text-xs text-gray-500 text-center">
                          点击展开查看完整内容
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              )}
            </CardContent>
          </Card>
        )}

        {/* 发布平台列表 */}
        <View className="space-y-3">
          <Text className="block text-base font-semibold text-gray-900 px-1">
            请为发布的平台填写反馈
          </Text>

          {publishResults.map((result: any, index: number) => {
            const platform = result.platform
            const platformName = PLATFORM_NAMES[platform] || platform
            const fb = feedback[platform] || { image: '', link: '' }

            return (
              <Card key={index}>
                <CardContent className="p-4 space-y-3">
                  {/* 平台名称和状态 */}
                  <View className="flex items-center justify-between">
                    <View className="flex items-center space-x-2">
                      <Text className="block text-base font-medium">{platformName}</Text>
                      <View
                        className={`px-2 py-1 rounded text-xs ${
                          result.status === 'success' ? 'bg-green-100 text-green-700' :
                          result.status === 'manual' ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}
                      >
                        {result.status === 'success' ? '已发布' :
                         result.status === 'manual' ? '需手动发布' : '发布异常'}
                      </View>
                    </View>
                  </View>

                  {/* 发布说明 */}
                  {result.message && (
                    <View className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <Text className="block text-xs text-orange-800">{result.message}</Text>
                      {result.status === 'manual' && (
                        <Text className="block text-xs text-orange-600 mt-2 font-medium">
                          请在手动发布后，上传截图并填写链接以完成反馈
                        </Text>
                      )}
                    </View>
                  )}

                  {/* 上传截图 */}
                  <View className="space-y-2">
                    <Label className="text-sm text-gray-700">发布截图</Label>
                    {fb.image ? (
                      <View className="relative" style={{ minHeight: '160px' }}>
                        <Image
                          src={fb.image}
                          style={{ width: '100%', height: '160px' }}
                          mode="aspectFill"
                          lazyLoad
                        />
                        <View
                          className="absolute top-2 right-2"
                          onClick={(e) => {
                            e.stopPropagation()
                            setFeedback(prev => ({
                              ...prev,
                              [platform]: { ...prev[platform], image: '' }
                            }))
                          }}
                        >
                          <View className="bg-red-500 text-white rounded px-2 py-1 text-xs">
                            删除
                          </View>
                        </View>
                      </View>
                    ) : (
                      <View
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50"
                        style={{ minHeight: '160px' }}
                        onClick={() => handleChooseImage(platform)}
                      >
                        <Upload size={32} color="#9ca3af" />
                        <Text className="block text-gray-500 text-sm mt-2">点击上传截图</Text>
                      </View>
                    )}
                  </View>

                  {/* 填写链接 */}
                  <View className="space-y-2">
                    <Label className="text-sm text-gray-700">发布链接</Label>
                    <View className="flex gap-2">
                      <View className="flex-1 bg-gray-50 rounded-lg px-4 py-3">
                        <Input
                          className="w-full bg-transparent"
                          placeholder="请输入发布链接"
                          value={fb.link}
                          onInput={(e) => handleLinkChange(platform, e.detail.value)}
                        />
                      </View>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleValidateLink(platform)}
                        disabled={validatingLinks[platform]}
                      >
                        <Text className="text-sm">
                          {validatingLinks[platform] ? '验证中...' : '验证'}
                        </Text>
                      </Button>
                    </View>

                    {/* 验证结果 */}
                    {fb.linkInfo && (
                      <View className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <View className="flex items-start gap-2">
                          <Text className="block text-xs font-medium text-blue-900">作品信息：</Text>
                        </View>
                        {fb.linkInfo.title && (
                          <Text className="block text-sm text-blue-800 mt-1">
                            标题：{fb.linkInfo.title}
                          </Text>
                        )}
                        {fb.linkInfo.author && (
                          <Text className="block text-xs text-blue-700 mt-1">
                            作者：{fb.linkInfo.author}
                          </Text>
                        )}
                        {fb.linkInfo.cover && (
                          <Image
                            src={fb.linkInfo.cover}
                            style={{ width: '80px', height: '80px', marginTop: '8px' }}
                            mode="aspectFill"
                            lazyLoad
                          />
                        )}
                      </View>
                    )}
                  </View>
                </CardContent>
              </Card>
            )
          })}
        </View>

        {/* 提交按钮 */}
        <View style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100 }} className="bg-white border-t border-gray-200 p-4">
          <Button
            className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-3 text-base font-medium"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? '提交中...' : '提交反馈'}
          </Button>
        </View>
      </View>

      {/* 🔴 调试信息 */}
      <View className="bg-black bg-opacity-80 text-white p-4 rounded-lg text-xs" style={{ position: 'fixed', bottom: 80, left: 10, right: 10, zIndex: 9999, maxHeight: '200px', overflow: 'auto' }}>
        <Text className="block font-bold mb-2">调试信息：</Text>
        <Text className="block">{JSON.stringify(feedback, null, 2)}</Text>
      </View>
    </View>
  )
}
