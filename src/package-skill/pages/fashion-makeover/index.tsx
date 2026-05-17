import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Upload, Sparkles, History, Shirt } from 'lucide-react-taro'

const BUILT_IN_PROMPT = `请根据用户输入的【主题】或上传的【参考图片】，创作一张横向 4:3 的高完成度「AI服装灵感方案 / AI Fashion Inspiration Board」。

【任务定位】
这不是普通穿搭拼图，不是简单的几套衣服展示，也不是电商商品推荐图，而是一张兼具「灵感提取 + 视觉转译 + 3套完整穿搭方案 + 专业提案感 + 实际上身效果」的中文高质量服装灵感设计图。

整张图的核心目标是：
1. 清楚呈现灵感来源；
2. 从灵感中提取色彩、气质、廓形、材质、细节与场景氛围；
3. 将这些视觉语言转译成 3 套有逻辑的完整穿搭方案；
4. 让用户第一眼觉得高级、时髦、专业，第二眼能看懂整套方案为什么这样设计，第三眼觉得这 3 套 look 既有审美表达，也真实可穿。`

interface HistoryRecord {
  id: string
  inputImageUrl: string
  inputText: string
  resultImageUrl: string
  status: string
  createdAt: string
}

export default function FashionMakeoverPage() {
  const [inputImageUrl, setInputImageUrl] = useState('')
  const [inputText, setInputText] = useState('')
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
        data: { skillType: 'fashion_makeover', limit: 20 }
      })
      console.log('[衣品改造] 历史记录:', res.data)
      const list = res.data?.data || []
      setHistory(list)
    } catch (e) {
      console.error('[衣品改造] 加载历史失败:', e)
    }
  }

  const handleChooseImage = () => {
    Taro.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        console.log('[衣品改造] 选择图片:', tempFilePath)
        Taro.showLoading({ title: '上传中...' })
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/ai-skill/upload',
            filePath: tempFilePath,
            name: 'file'
          })
          console.log('[衣品改造] 上传结果:', uploadRes.data)
          const data = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
          const url = data?.data?.url || data?.data?.imageUrl || ''
          if (url) {
            setInputImageUrl(url)
          } else {
            Taro.showToast({ title: '上传失败', icon: 'none' })
          }
        } catch (e) {
          console.error('[衣品改造] 上传失败:', e)
          Taro.showToast({ title: '上传失败', icon: 'none' })
        } finally {
          Taro.hideLoading()
        }
      }
    })
  }

  const handleGenerate = async () => {
    if (!inputImageUrl && !inputText.trim()) {
      Taro.showToast({ title: '请上传参考图或输入主题', icon: 'none' })
      return
    }
    setGenerating(true)
    setResultImageUrl('')
    try {
      console.log('[衣品改造] 开始生成')
      const res = await Network.request({
        url: '/api/ai-skill/generate',
        method: 'POST',
        data: {
          skillType: 'fashion_makeover',
          inputImageUrl: inputImageUrl || undefined,
          inputText: inputText.trim() || undefined,
          prompt: BUILT_IN_PROMPT
        }
      })
      console.log('[衣品改造] 生成结果:', res.data)
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
      console.error('[衣品改造] 生成失败:', e)
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
        console.log(`[衣品改造] 轮询 #${attempts}:`, data?.status)
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
          <Shirt size={28} color="#ffffff" className="mr-2" />
          <Text className="block text-xl font-bold text-white">衣品改造</Text>
        </View>
        <Text className="block text-sm text-white text-opacity-80 leading-relaxed">
          上传参考图或输入穿搭主题，AI 为您生成 3 套完整穿搭灵感方案
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
            {/* 输入区域 */}
            <Card className="mb-4">
              <CardContent className="p-4">
                {/* 参考图上传 */}
                <Text className="block text-sm font-semibold text-gray-700 mb-3">上传参考图片</Text>
                {inputImageUrl ? (
                  <View className="relative mb-4">
                    <Image
                      src={inputImageUrl}
                      className="w-full rounded-xl"
                      mode="aspectFit"
                      style={{ maxHeight: '240px' }}
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
                    className="flex flex-col items-center justify-center rounded-xl py-8 mb-4"
                    style={{ border: '2px dashed #D4BFFF', backgroundColor: '#F3E8FF' }}
                    onClick={handleChooseImage}
                  >
                    <Upload size={28} color="#7B3FE4" />
                    <Text className="block text-sm mt-2" style={{ color: '#7B3FE4' }}>上传参考穿搭图片</Text>
                    <Text className="block text-xs mt-1 text-gray-400">可选，支持相册或拍照</Text>
                  </View>
                )}

                {/* 主题输入 */}
                <Text className="block text-sm font-semibold text-gray-700 mb-2">穿搭主题</Text>
                <View className="rounded-xl px-3 py-2" style={{ backgroundColor: '#F5F5F7' }}>
                  <View className="flex flex-row flex-wrap gap-2 mb-2">
                    {['职场通勤', '周末休闲', '约会穿搭', '运动活力'].map(tag => (
                      <View
                        key={tag}
                        className="rounded-full px-3 py-1"
                        style={{ backgroundColor: inputText === tag ? '#7B3FE4' : '#EDE9FE' }}
                        onClick={() => setInputText(inputText === tag ? '' : tag)}
                      >
                        <Text className="text-xs" style={{ color: inputText === tag ? '#ffffff' : '#7B3FE4' }}>
                          {tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <View className="mt-2 rounded-lg px-3 py-2" style={{ backgroundColor: '#ffffff' }}>
                    <Input
                      className="text-sm"
                      placeholder="或自定义主题，如：法式复古、韩系简约..."
                      value={inputText}
                      onInput={(e) => setInputText(e.detail.value)}
                    />
                  </View>
                </View>
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <Button
              className="w-full mb-4"
              style={{ backgroundColor: '#7B3FE4' }}
              disabled={(!inputImageUrl && !inputText.trim()) || generating}
              onClick={handleGenerate}
            >
              <View className="flex flex-row items-center justify-center">
                <Sparkles size={16} color="#ffffff" className="mr-2" />
                <Text className="text-white font-semibold">
                  {generating ? 'AI 正在创作灵感方案...' : '生成穿搭灵感'}
                </Text>
              </View>
            </Button>

            {/* 生成结果 */}
            {resultImageUrl && (
              <Card>
                <CardContent className="p-4">
                  <View className="flex flex-row items-center mb-3">
                    <View className="w-1 h-4 rounded-full mr-2" style={{ backgroundColor: '#7B3FE4' }} />
                    <Text className="block text-sm font-semibold text-gray-800">穿搭灵感方案</Text>
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
                    <Text className="block text-sm font-semibold" style={{ color: '#7B3FE4' }}>AI 正在创作穿搭灵感</Text>
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
                  <Shirt size={40} color="#D4BFFF" />
                  <Text className="block text-sm text-gray-400 mt-3">暂无穿搭灵感记录</Text>
                  <Text className="block text-xs text-gray-300 mt-1">上传参考图或输入主题开始体验</Text>
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
                            {item.inputText || '穿搭灵感方案'}
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
