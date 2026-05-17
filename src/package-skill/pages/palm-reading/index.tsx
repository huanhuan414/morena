import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Network } from '@/network'
import { Upload, Sparkles, History, Hand } from 'lucide-react-taro'

const BUILT_IN_PROMPT = `根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。
专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能`

interface HistoryRecord {
  id: string
  inputImageUrl: string
  inputText: string
  resultImageUrl: string
  status: string
  createdAt: string
}

export default function PalmReadingPage() {
  const [inputImageUrl, setInputImageUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [history, setHistory] = useState<HistoryRecord[]>([])

  useDidShow(() => {
    loadHistory()
  })

  const loadHistory = async () => {
    try {
      const res = await Network.request({
        url: '/api/ai-skill/history',
        data: { skillType: 'palm_reading', limit: 20 }
      })
      console.log('[掌相阅读] 历史记录:', res.data)
      const rawData = res.data?.data
      const list = Array.isArray(rawData) ? rawData : (rawData?.list || [])
      setHistory(list)
    } catch (e) {
      console.error('[掌相阅读] 加载历史失败:', e)
    }
  }

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        console.log('[掌相阅读] 选择图片:', tempFilePath)
        Taro.showLoading({ title: '上传中...' })
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/ai-skill/upload',
            filePath: tempFilePath,
            name: 'file'
          })
          console.log('[掌相阅读] 上传结果:', uploadRes.data)
          const data = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
          const url = data?.data?.url || data?.data?.imageUrl || ''
          if (url) {
            setInputImageUrl(url)
          } else {
            Taro.showToast({ title: '上传失败', icon: 'none' })
          }
        } catch (e) {
          console.error('[掌相阅读] 上传失败:', e)
          Taro.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          Taro.hideLoading()
        }
      }
    })
  }

  const handleGenerate = async () => {
    if (!inputImageUrl) {
      Taro.showToast({ title: '请先上传手掌照片', icon: 'none' })
      return
    }
    setGenerating(true)
    setResultImageUrl('')
    try {
      console.log('[掌相阅读] 开始生成, inputImageUrl:', inputImageUrl)
      const res = await Network.request({
        url: '/api/ai-skill/generate',
        method: 'POST',
        data: {
          skillType: 'palm_reading',
          inputImageUrl,
          prompt: BUILT_IN_PROMPT
        }
      })
      console.log('[掌相阅读] 生成结果:', res.data)
      const data = res.data?.data
      if (data?.resultImageUrl) {
        setResultImageUrl(data.resultImageUrl)
        Taro.showToast({ title: '生成成功', icon: 'success' })
        loadHistory()
      } else if (data?.status === 'pending' || data?.status === 'generating') {
        pollResult(data.id)
      } else {
        Taro.showToast({ title: data?.errorMessage || '生成失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[掌相阅读] 生成失败:', e)
      Taro.showToast({ title: '生成失败，请重试', icon: 'none' })
    } finally {
      setGenerating(false)
    }
  }

  const pollResult = async (recordId: string) => {
    let attempts = 0
    const maxAttempts = 60
    const poll = async (): Promise<void> => {
      if (attempts >= maxAttempts) {
        Taro.showToast({ title: '生成超时，请稍后查看历史', icon: 'none' })
        return
      }
      attempts++
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await Network.request({
          url: `/api/ai-skill/record/${recordId}`
        })
        const data = res.data?.data
        console.log(`[掌相阅读] 轮询 #${attempts}:`, data?.status)
        if (data?.status === 'completed' && data?.resultImageUrl) {
          setResultImageUrl(data.resultImageUrl)
          Taro.showToast({ title: '生成成功', icon: 'success' })
          loadHistory()
          return
        } else if (data?.status === 'failed') {
          Taro.showToast({ title: data.errorMessage || '生成失败', icon: 'none' })
          return
        }
        return poll()
      } catch {
        return poll()
      }
    }
    setGenerating(true)
    await poll()
    setGenerating(false)
  }

  const handlePreviewImage = (url: string) => {
    Taro.previewImage({ urls: [url], current: url })
  }

  return (
    <View className="flex flex-col min-h-screen" style={{ background: '#F8F7FC' }}>
      {/* 渐变 Header */}
      <View className="px-4 pt-6 pb-8" style={{ background: 'linear-gradient(135deg, #7B3FE4 0%, #9B6EF3 100%)' }}>
        <View className="flex flex-row items-center mb-3">
          <Hand size={28} color="#ffffff" className="mr-2" />
          <Text className="block text-xl font-bold text-white">掌相阅读</Text>
        </View>
        <Text className="block text-sm text-white text-opacity-80 leading-relaxed">
          上传手掌照片，AI 为您生成专属掌相分析图，干净简约风格，细线条圆角卡片设计
        </Text>
      </View>

      <View className="px-4 -mt-4">
        <Tabs defaultValue="generate">
          <TabsList className="mb-4">
            <TabsTrigger value="generate">
              <View className="flex flex-row items-center">
                <Sparkles size={14} color="#7B3FE4" className="mr-1" />
                <Text className="text-sm">AI 生成</Text>
              </View>
            </TabsTrigger>
            <TabsTrigger value="history">
              <View className="flex flex-row items-center">
                <History size={14} color="#7B3FE4" className="mr-1" />
                <Text className="text-sm">历史记录</Text>
              </View>
            </TabsTrigger>
          </TabsList>

          {/* 生成 Tab */}
          <TabsContent value="generate">
            {/* 上传区域 */}
            <Card className="mb-4">
              <CardContent className="p-4">
                <Text className="block text-sm font-semibold text-gray-700 mb-3">上传手掌照片</Text>
                {inputImageUrl ? (
                  <View className="relative">
                    <Image
                      src={inputImageUrl}
                      className="w-full rounded-xl"
                      mode="aspectFit"
                      style={{ maxHeight: '280px' }}
                      onClick={() => handlePreviewImage(inputImageUrl)}
                    />
                    <View
                      className="absolute top-2 right-2 rounded-full flex items-center justify-center"
                      style={{ width: '28px', height: '28px', backgroundColor: 'rgba(0,0,0,0.5)' }}
                      onClick={() => setInputImageUrl('')}
                    >
                      <Text className="text-white text-xs">✕</Text>
                    </View>
                  </View>
                ) : (
                  <View
                    className="flex flex-col items-center justify-center rounded-xl py-10"
                    style={{ border: '2px dashed #D4BFFF', backgroundColor: '#F3E8FF' }}
                    onClick={handleChooseImage}
                  >
                    <Upload size={32} color="#7B3FE4" />
                    <Text className="block text-sm mt-2" style={{ color: '#7B3FE4' }}>点击上传手掌照片</Text>
                    <Text className="block text-xs mt-1 text-gray-400">支持相册选择或拍照</Text>
                  </View>
                )}
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <Button
              className="w-full mb-4"
              style={{ backgroundColor: '#7B3FE4' }}
              disabled={!inputImageUrl || generating}
              onClick={handleGenerate}
            >
              <View className="flex flex-row items-center justify-center">
                <Sparkles size={16} color="#ffffff" className="mr-2" />
                <Text className="text-white font-semibold">
                  {generating ? 'AI 正在解读掌纹...' : '开始解读掌相'}
                </Text>
              </View>
            </Button>

            {/* 生成结果 */}
            {resultImageUrl && (
              <Card>
                <CardContent className="p-4">
                  <View className="flex flex-row items-center mb-3">
                    <View className="w-1 h-4 rounded-full mr-2" style={{ backgroundColor: '#7B3FE4' }} />
                    <Text className="block text-sm font-semibold text-gray-800">掌相解读结果</Text>
                  </View>
                  <View className="rounded-xl overflow-hidden">
                    <Image
                      src={resultImageUrl}
                      className="w-full"
                      mode="widthFix"
                      onClick={() => handlePreviewImage(resultImageUrl)}
                    />
                  </View>
                  <View className="mt-3 flex flex-row gap-2">
                    <View className="flex-1">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        style={{ borderColor: '#7B3FE4', color: '#7B3FE4' }}
                        onClick={() => {
                          Taro.saveImageToPhotosAlbum({ filePath: resultImageUrl })
                            .then(() => Taro.showToast({ title: '已保存', icon: 'success' }))
                            .catch(() => Taro.showToast({ title: '保存失败', icon: 'none' }))
                        }}
                      >
                        <Text className="text-xs" style={{ color: '#7B3FE4' }}>保存到相册</Text>
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        size="sm"
                        className="w-full"
                        style={{ backgroundColor: '#7B3FE4' }}
                        onClick={() => handlePreviewImage(resultImageUrl)}
                      >
                        <Text className="text-xs text-white">查看大图</Text>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )}

            {/* 生成中提示 */}
            {generating && !resultImageUrl && (
              <Card className="mb-4">
                <CardContent className="p-6 flex flex-col items-center">
                  <View className="flex flex-row items-center mb-2">
                    <Sparkles size={20} color="#7B3FE4" className="mr-2" />
                    <Text className="block text-sm font-semibold" style={{ color: '#7B3FE4' }}>AI 正在解读您的掌纹</Text>
                  </View>
                  <Text className="block text-xs text-gray-400 mt-1">预计需要 15-30 秒，请耐心等待...</Text>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* 历史 Tab */}
          <TabsContent value="history">
            {history.length === 0 ? (
              <Card>
                <CardContent className="p-8 flex flex-col items-center">
                  <Hand size={40} color="#D4BFFF" />
                  <Text className="block text-sm text-gray-400 mt-3">暂无解读记录</Text>
                  <Text className="block text-xs text-gray-300 mt-1">上传手掌照片开始体验</Text>
                </CardContent>
              </Card>
            ) : (
              <View className="flex flex-col gap-3">
                {history.map((item) => (
                  <Card key={item.id} onClick={() => item.resultImageUrl && handlePreviewImage(item.resultImageUrl)}>
                    <CardContent className="p-3">
                      <View className="flex flex-row">
                        {item.inputImageUrl && (
                          <Image
                            src={item.inputImageUrl}
                            className="rounded-lg"
                            mode="aspectFill"
                            style={{ width: '56px', height: '56px' }}
                          />
                        )}
                        <View className="flex-1 ml-3 justify-center">
                          <Text className="block text-sm font-medium text-gray-700">
                            掌相解读
                          </Text>
                          <View className="flex flex-row items-center mt-1">
                            <View
                              className="w-2 h-2 rounded-full mr-1"
                              style={{ backgroundColor: item.status === 'completed' ? '#10B981' : item.status === 'failed' ? '#EF4444' : '#F59E0B' }}
                            />
                            <Text className="block text-xs text-gray-400">
                              {item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '生成中'}
                            </Text>
                          </View>
                          <Text className="block text-xs text-gray-300 mt-1">{item.createdAt}</Text>
                        </View>
                        {item.resultImageUrl && (
                          <Image
                            src={item.resultImageUrl}
                            className="rounded-lg"
                            mode="aspectFill"
                            style={{ width: '48px', height: '48px' }}
                          />
                        )}
                      </View>
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </TabsContent>
        </Tabs>
      </View>

      <View className="h-8" />
    </View>
  )
}
