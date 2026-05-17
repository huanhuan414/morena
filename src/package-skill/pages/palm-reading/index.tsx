import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'

const BUILT_IN_PROMPT = `根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。
专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能`

interface HistoryRecord {
  id: string
  inputImageUrl: string
  resultImageUrl: string
  status: string
  createdAt: string
}

export default function PalmReadingPage() {
  const [inputImageUrl, setInputImageUrl] = useState('')
  const [generating, setGenerating] = useState(false)
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [showHistory, setShowHistory] = useState(false)

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
      const list = res.data?.data || []
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

  const handlePreviewResult = () => {
    if (resultImageUrl) {
      Taro.previewImage({ urls: [resultImageUrl], current: resultImageUrl })
    }
  }

  const handlePreviewHistory = (item: HistoryRecord) => {
    const urls = [item.resultImageUrl]
    if (item.inputImageUrl) urls.unshift(item.inputImageUrl)
    Taro.previewImage({ urls, current: item.resultImageUrl })
  }

  return (
    <View className="flex flex-col min-h-screen bg-gray-50">
      {/* 顶部说明 */}
      <View className="mx-4 mt-4 p-4 bg-white rounded-2xl shadow-sm">
        <Text className="block text-lg font-bold text-gray-800 mb-2">AI 掌相阅读</Text>
        <Text className="block text-sm text-gray-500 leading-relaxed">上传您的手掌照片，AI 将为您生成一份精美的掌相阅读指南，包含掌纹分析与解读。</Text>
      </View>

      {/* 上传区域 */}
      <View className="mx-4 mt-4">
        <Text className="block text-base font-semibold text-gray-700 mb-2">上传手掌照片</Text>
        {inputImageUrl ? (
          <View className="relative">
            <Image
              src={inputImageUrl}
              className="w-full rounded-2xl"
              mode="aspectFit"
              style={{ maxHeight: '300px' }}
              onClick={() => Taro.previewImage({ urls: [inputImageUrl] })}
            />
            <View
              className="absolute top-2 right-2 bg-black bg-opacity-50 rounded-full w-8 h-8 flex items-center justify-center"
              onClick={() => setInputImageUrl('')}
            >
              <Text className="text-white text-sm">✕</Text>
            </View>
          </View>
        ) : (
          <View
            className="flex flex-col items-center justify-center bg-white rounded-2xl border-2 border-dashed border-gray-300 py-12"
            onClick={handleChooseImage}
          >
            <Text className="block text-4xl mb-2">📷</Text>
            <Text className="block text-sm text-gray-400">点击上传手掌照片</Text>
          </View>
        )}
      </View>

      {/* 生成按钮 */}
      <View className="mx-4 mt-4">
        <Button
          className="w-full"
          disabled={!inputImageUrl || generating}
          onClick={handleGenerate}
        >
          <Text className="text-white font-semibold">
            {generating ? '正在生成中...' : '开始掌相阅读'}
          </Text>
        </Button>
      </View>

      {/* 生成结果 */}
      {resultImageUrl && (
        <View className="mx-4 mt-4">
          <Text className="block text-base font-semibold text-gray-700 mb-2">阅读结果</Text>
          <View className="bg-white rounded-2xl overflow-hidden shadow-sm">
            <Image
              src={resultImageUrl}
              className="w-full"
              mode="widthFix"
              onClick={handlePreviewResult}
            />
          </View>
          <View className="mt-2 flex flex-row gap-2">
            <View className="flex-1">
              <Button size="sm" variant="outline" className="w-full" onClick={() => Taro.saveImageToPhotosAlbum({ filePath: resultImageUrl }).then(() => Taro.showToast({ title: '已保存', icon: 'success' })).catch(() => Taro.showToast({ title: '保存失败', icon: 'none' }))}>
                <Text className="text-xs">保存到相册</Text>
              </Button>
            </View>
          </View>
        </View>
      )}

      {/* 历史记录 */}
      <View className="mx-4 mt-6 mb-8">
        <View className="flex flex-row items-center justify-between mb-2" onClick={() => setShowHistory(!showHistory)}>
          <Text className="block text-base font-semibold text-gray-700">历史记录</Text>
          <Text className="block text-sm text-gray-400">{showHistory ? '收起' : '展开'} ({history.length})</Text>
        </View>
        {showHistory && (
          history.length === 0 ? (
            <View className="bg-white rounded-2xl py-8 flex items-center justify-center">
              <Text className="block text-sm text-gray-400">暂无记录</Text>
            </View>
          ) : (
            <View className="flex flex-col gap-2">
              {history.map((item) => (
                <View
                  key={item.id}
                  className="flex flex-row bg-white rounded-xl p-3 shadow-sm"
                  onClick={() => item.resultImageUrl && handlePreviewHistory(item)}
                >
                  {item.inputImageUrl && (
                    <Image src={item.inputImageUrl} className="w-16 h-16 rounded-lg" mode="aspectFill" />
                  )}
                  <View className="flex-1 ml-3 justify-center">
                    <Text className="block text-sm text-gray-700">
                      {item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '生成中'}
                    </Text>
                    <Text className="block text-xs text-gray-400 mt-1">{item.createdAt}</Text>
                  </View>
                  {item.resultImageUrl && (
                    <Image src={item.resultImageUrl} className="w-12 h-12 rounded-lg" mode="aspectFill" />
                  )}
                </View>
              ))}
            </View>
          )
        )}
      </View>
    </View>
  )
}
