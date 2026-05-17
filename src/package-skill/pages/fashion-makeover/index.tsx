import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, Input } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Network } from '@/network'

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
  const [showHistory, setShowHistory] = useState(false)

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
      Taro.showToast({ title: '请上传参考图片或输入主题', icon: 'none' })
      return
    }
    setGenerating(true)
    setResultImageUrl('')
    try {
      console.log('[衣品改造] 开始生成, inputImageUrl:', inputImageUrl, 'inputText:', inputText)
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
        <Text className="block text-lg font-bold text-gray-800 mb-2">AI 衣品改造</Text>
        <Text className="block text-sm text-gray-500 leading-relaxed">上传参考图片或输入主题，AI 为您生成 3 套完整的穿搭灵感方案。</Text>
      </View>

      {/* 上传区域 */}
      <View className="mx-4 mt-4">
        <Text className="block text-base font-semibold text-gray-700 mb-2">上传参考图片</Text>
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
            <Text className="block text-4xl mb-2">👗</Text>
            <Text className="block text-sm text-gray-400">点击上传参考图片</Text>
          </View>
        )}
      </View>

      {/* 主题输入 */}
      <View className="mx-4 mt-4">
        <Text className="block text-base font-semibold text-gray-700 mb-2">输入主题（可选）</Text>
        <View className="bg-white rounded-xl px-4 py-3">
          <Input
            className="w-full bg-transparent text-sm"
            placeholder="如：职场精英、周末休闲、约会穿搭..."
            value={inputText}
            onInput={(e) => setInputText(e.detail.value)}
          />
        </View>
      </View>

      {/* 生成按钮 */}
      <View className="mx-4 mt-4">
        <Button
          className="w-full"
          disabled={(!inputImageUrl && !inputText.trim()) || generating}
          onClick={handleGenerate}
        >
          <Text className="text-white font-semibold">
            {generating ? '正在生成中...' : '开始生成穿搭方案'}
          </Text>
        </Button>
      </View>

      {/* 生成结果 */}
      {resultImageUrl && (
        <View className="mx-4 mt-4">
          <Text className="block text-base font-semibold text-gray-700 mb-2">穿搭方案</Text>
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
                      {item.inputText ? item.inputText.substring(0, 20) : (item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '生成中')}
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
