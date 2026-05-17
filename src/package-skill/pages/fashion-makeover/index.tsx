import { useState, useRef } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Network } from '@/network'
import { Upload, Sparkles, History, Shirt, ArrowLeft, Image as ImageIcon, Save, Expand } from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'

interface HistoryRecord {
  id: string
  inputImageUrl: string
  inputText: string
  resultImageUrl: string
  status: string
  errorMessage: string
  createdAt: string
}

// 主色：玫瑰红
const PRIMARY = '#E11D48'
const PRIMARY_LIGHT = '#FB7185'
const PRIMARY_FAINT = '#FFF1F2'
const PRIMARY_BORDER = '#FECDD3'

const SCENE_TAGS = [
  { label: '职场通勤', emoji: '💼' },
  { label: '周末休闲', emoji: '☕' },
  { label: '约会穿搭', emoji: '🌹' },
  { label: '运动活力', emoji: '🏃' },
  { label: '法式复古', emoji: '🗼' },
  { label: '韩系简约', emoji: '🇰🇷' },
  { label: '街头潮酷', emoji: '🛹' },
  { label: '度假风', emoji: '🏖️' },
]

export default function FashionMakeoverPage() {
  const statusBarHeight = getStatusBarHeight()
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [inputImageUrl, setInputImageUrl] = useState('')
  const [inputText, setInputText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [resultImageUrl, setResultImageUrl] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const pollingRef = useRef(false)

  useDidShow(() => {
    loadHistory()
  })

  const loadHistory = async () => {
    try {
      const res = await Network.request({
        url: '/api/ai-skill/history',
        data: { skillType: 'fashion_makeover', pageSize: 20 }
      })
      console.log('[衣品改造] 历史记录:', res.data)
      const rawData = res.data?.data
      const list = Array.isArray(rawData) ? rawData : (rawData?.list || [])
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
    setErrorMessage('')
    try {
      console.log('[衣品改造] 开始生成, hasImage:', !!inputImageUrl, 'inputText:', inputText)
      const res = await Network.request({
        url: '/api/ai-skill/generate',
        method: 'POST',
        data: {
          skillType: 'fashion_makeover',
          inputImageUrl: inputImageUrl || undefined,
          inputText: inputText.trim() || undefined,
        }
      })
      console.log('[衣品改造] 生成响应:', res.data)
      const data = res.data?.data
      if (data?.id && (data?.status === 'generating' || data?.status === 'pending')) {
        // 异步模式：立即拿到 recordId，开始轮询
        startPolling(data.id)
      } else if (data?.resultImageUrl) {
        // 同步返回了结果（兜底）
        setResultImageUrl(data.resultImageUrl)
        setGenerating(false)
        Taro.showToast({ title: '生成成功', icon: 'success' })
        loadHistory()
      } else {
        // 提交失败
        setGenerating(false)
        setErrorMessage(data?.errorMessage || res.data?.msg || '提交失败，请重试')
        Taro.showToast({ title: res.data?.msg || '提交失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[衣品改造] 生成请求失败:', e)
      setGenerating(false)
      setErrorMessage(e?.message || '网络错误，请重试')
      Taro.showToast({ title: '网络错误，请重试', icon: 'none' })
    }
  }

  /** 开始轮询生成状态 */
  const startPolling = (recordId: string) => {
    if (pollingRef.current) return
    pollingRef.current = true
    let attempts = 0
    const maxAttempts = 60

    const poll = async () => {
      if (attempts >= maxAttempts || !pollingRef.current) {
        pollingRef.current = false
        setGenerating(false)
        if (attempts >= maxAttempts) {
          setErrorMessage('生成超时，请稍后在历史记录中查看')
          Taro.showToast({ title: '生成超时', icon: 'none' })
        }
        return
      }
      attempts++
      await new Promise(r => setTimeout(r, 3000))
      try {
        const res = await Network.request({
          url: `/api/ai-skill/record/${recordId}`
        })
        const data = res.data?.data
        console.log(`[衣品改造] 轮询 #${attempts}: status=${data?.status}`)
        if (data?.status === 'completed' && data?.resultImageUrl) {
          setResultImageUrl(data.resultImageUrl)
          setGenerating(false)
          pollingRef.current = false
          Taro.showToast({ title: '生成成功', icon: 'success' })
          loadHistory()
          return
        } else if (data?.status === 'failed') {
          setGenerating(false)
          pollingRef.current = false
          const msg = data?.errorMessage || '生成失败'
          setErrorMessage(msg)
          Taro.showToast({ title: msg, icon: 'none' })
          return
        }
        poll()
      } catch (e) {
        console.error(`[衣品改造] 轮询异常 #${attempts}:`, e)
        poll()
      }
    }
    poll()
  }

  const handlePreviewImage = (url: string) => {
    Taro.previewImage({ urls: [url], current: url })
  }

  return (
    <View className="flex flex-col" style={{ minHeight: '100vh', backgroundColor: '#F8F7FC' }}>
      {/* 渐变 Header */}
      <View
        style={{
          background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`,
          paddingTop: `${statusBarHeight + 12}px`,
          paddingBottom: '24px',
          paddingLeft: '16px',
          paddingRight: '16px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 装饰圆 */}
        <View style={{ position: 'absolute', top: '-30px', right: '-20px', width: '120px', height: '120px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <View style={{ position: 'absolute', bottom: '-20px', left: '-10px', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.06)' }} />

        {/* 导航栏 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
          <View
            style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => Taro.navigateBack()}
          >
            <ArrowLeft size={18} color="#ffffff" />
          </View>
        </View>

        {/* 标题区域 */}
        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '8px' }}>
          <View style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px' }}>
            <Shirt size={20} color="#ffffff" />
          </View>
          <View>
            <Text className="block text-xl font-bold text-white">衣品改造</Text>
          </View>
        </View>
        <Text className="block text-sm text-white leading-relaxed" style={{ opacity: 0.8 }}>
          上传参考图或输入穿搭主题，AI 生成 3 套穿搭灵感方案
        </Text>
      </View>

      {/* Tab 切换栏 */}
      <View style={{ paddingLeft: '16px', paddingRight: '16px', marginTop: '-16px', position: 'relative', zIndex: 10 }}>
        <View style={{ display: 'flex', flexDirection: 'row', backgroundColor: PRIMARY_FAINT, borderRadius: '12px', padding: '3px' }}>
          <View
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingTop: '8px', paddingBottom: '8px',
              borderRadius: '10px',
              backgroundColor: activeTab === 'generate' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'generate' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}
            onClick={() => setActiveTab('generate')}
          >
            <Sparkles size={14} color={PRIMARY} style={{ marginRight: '4px' }} />
            <Text className="text-sm font-medium" style={{ color: activeTab === 'generate' ? PRIMARY : '#666' }}>AI 生成</Text>
          </View>
          <View
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
              paddingTop: '8px', paddingBottom: '8px',
              borderRadius: '10px',
              backgroundColor: activeTab === 'history' ? '#ffffff' : 'transparent',
              boxShadow: activeTab === 'history' ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
            }}
            onClick={() => setActiveTab('history')}
          >
            <History size={14} color={PRIMARY} style={{ marginRight: '4px' }} />
            <Text className="text-sm font-medium" style={{ color: activeTab === 'history' ? PRIMARY : '#666' }}>历史记录</Text>
          </View>
        </View>
      </View>

      <ScrollView scrollY className="flex-1" style={{ paddingLeft: '16px', paddingRight: '16px', paddingTop: '16px' }}>
        {/* ====== 生成 Tab ====== */}
        {activeTab === 'generate' && (
          <View>
            {/* 场景标签选择 */}
            <Card style={{ marginBottom: '12px' }}>
              <CardContent style={{ padding: '16px' }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
                  <View style={{ width: '4px', height: '16px', borderRadius: '2px', backgroundColor: PRIMARY, marginRight: '8px' }} />
                  <Text className="block text-sm font-semibold" style={{ color: '#1A1A2E' }}>穿搭场景</Text>
                </View>

                <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}>
                  {SCENE_TAGS.map(tag => (
                    <View
                      key={tag.label}
                      style={{
                        display: 'flex', flexDirection: 'row', alignItems: 'center',
                        paddingLeft: '12px', paddingRight: '12px', paddingTop: '6px', paddingBottom: '6px',
                        borderRadius: '20px',
                        backgroundColor: inputText === tag.label ? PRIMARY : PRIMARY_FAINT,
                        border: inputText === tag.label ? 'none' : `1px solid ${PRIMARY_BORDER}`,
                      }}
                      onClick={() => setInputText(inputText === tag.label ? '' : tag.label)}
                    >
                      <Text style={{ fontSize: '13px', marginRight: '3px' }}>{tag.emoji}</Text>
                      <Text style={{ fontSize: '12px', color: inputText === tag.label ? '#ffffff' : PRIMARY }}>
                        {tag.label}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* 自定义输入 */}
                <View style={{ marginTop: '12px', backgroundColor: '#F5F5F7', borderRadius: '10px', paddingLeft: '12px', paddingRight: '12px' }}>
                  <Input
                    style={{ width: '100%', fontSize: '14px', height: '40px' }}
                    placeholder="或自定义主题，如：日系森女、极简黑白..."
                    value={inputText}
                    onInput={(e) => setInputText(e.detail.value)}
                  />
                </View>
              </CardContent>
            </Card>

            {/* 参考图上传 */}
            <Card style={{ marginBottom: '12px' }}>
              <CardContent style={{ padding: '16px' }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
                  <View style={{ width: '4px', height: '16px', borderRadius: '2px', backgroundColor: PRIMARY, marginRight: '8px' }} />
                  <Text className="block text-sm font-semibold" style={{ color: '#1A1A2E' }}>参考图片</Text>
                  <Text className="block text-xs ml-2" style={{ color: '#999999' }}>（可选）</Text>
                </View>

                {inputImageUrl ? (
                  <View style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden' }}>
                    <Image
                      src={inputImageUrl}
                      style={{ width: '100%', maxHeight: '200px' }}
                      mode="aspectFit"
                      onClick={() => handlePreviewImage(inputImageUrl)}
                    />
                    <View
                      style={{
                        position: 'absolute', top: '8px', right: '8px',
                        width: '28px', height: '28px', borderRadius: '50%',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onClick={() => { setInputImageUrl(''); setResultImageUrl(''); setErrorMessage(''); }}
                    >
                      <Text style={{ color: '#ffffff', fontSize: '14px' }}>✕</Text>
                    </View>
                    <View
                      style={{
                        position: 'absolute', bottom: '8px', right: '8px',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        borderRadius: '20px', paddingLeft: '12px', paddingRight: '12px', paddingTop: '4px', paddingBottom: '4px',
                        display: 'flex', flexDirection: 'row', alignItems: 'center',
                      }}
                      onClick={handleChooseImage}
                    >
                      <Upload size={12} color="#ffffff" style={{ marginRight: '4px' }} />
                      <Text style={{ color: '#ffffff', fontSize: '11px' }}>重新上传</Text>
                    </View>
                  </View>
                ) : (
                  <View
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      borderRadius: '12px', paddingTop: '28px', paddingBottom: '28px',
                      border: `2px dashed ${PRIMARY_BORDER}`, backgroundColor: PRIMARY_FAINT,
                    }}
                    onClick={handleChooseImage}
                  >
                    <View style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: 'rgba(225,29,72,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px' }}>
                      <Upload size={22} color={PRIMARY} />
                    </View>
                    <Text className="block text-sm font-medium" style={{ color: PRIMARY }}>上传参考穿搭图片</Text>
                    <Text className="block text-xs mt-1" style={{ color: '#999999' }}>支持相册或拍照</Text>
                  </View>
                )}
              </CardContent>
            </Card>

            {/* 生成按钮 */}
            <View style={{ marginBottom: '12px' }}>
              <Button
                className="w-full"
                style={{ backgroundColor: generating ? '#F9A8BA' : PRIMARY, borderRadius: '12px', height: '44px' }}
                disabled={(!inputImageUrl && !inputText.trim()) || generating}
                onClick={handleGenerate}
              >
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={16} color="#ffffff" style={{ marginRight: '6px' }} />
                  <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: '15px' }}>
                    {generating ? 'AI 正在创作灵感方案...' : '生成穿搭灵感'}
                  </Text>
                </View>
              </Button>
            </View>

            {/* 生成中提示 */}
            {generating && !resultImageUrl && (
              <Card style={{ marginBottom: '12px' }}>
                <CardContent style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: PRIMARY_FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Sparkles size={28} color={PRIMARY} />
                  </View>
                  <Text className="block text-sm font-semibold" style={{ color: PRIMARY }}>AI 正在创作穿搭灵感</Text>
                  <Text className="block text-xs mt-2" style={{ color: '#999999' }}>正在生成 3 套穿搭方案...</Text>
                  <Text className="block text-xs mt-1" style={{ color: '#cccccc' }}>预计需要 15-60 秒，请勿离开页面</Text>
                </CardContent>
              </Card>
            )}

            {/* 生成失败提示 */}
            {errorMessage && !generating && (
              <Card style={{ marginBottom: '12px' }}>
                <CardContent style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                    <Text style={{ fontSize: '20px', color: '#EF4444' }}>✕</Text>
                  </View>
                  <Text className="block text-sm font-semibold" style={{ color: '#EF4444' }}>生成失败</Text>
                  <Text className="block text-xs mt-2" style={{ color: '#999999', textAlign: 'center' }}>{errorMessage}</Text>
                  <View style={{ marginTop: '12px' }}>
                    <Button size="sm" style={{ backgroundColor: PRIMARY, borderRadius: '20px', paddingLeft: '24px', paddingRight: '24px' }} onClick={handleGenerate}>
                      <Text style={{ color: '#ffffff', fontSize: '13px' }}>重新生成</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            )}

            {/* 生成结果 */}
            {resultImageUrl && (
              <Card style={{ marginBottom: '16px' }}>
                <CardContent style={{ padding: '16px' }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
                    <View style={{ width: '4px', height: '16px', borderRadius: '2px', backgroundColor: PRIMARY, marginRight: '8px' }} />
                    <Text className="block text-sm font-semibold" style={{ color: '#1A1A2E' }}>穿搭灵感方案</Text>
                    {inputText && (
                      <View style={{ marginLeft: '8px', paddingLeft: '8px', paddingRight: '8px', paddingTop: '2px', paddingBottom: '2px', borderRadius: '10px', backgroundColor: PRIMARY_FAINT }}>
                        <Text style={{ fontSize: '11px', color: PRIMARY }}>{inputText}</Text>
                      </View>
                    )}
                  </View>

                  {/* 参考图 vs 结果对比（如果有参考图） */}
                  {inputImageUrl && (
                    <View style={{ display: 'flex', flexDirection: 'row', gap: '8px', marginBottom: '12px' }}>
                      <View style={{ flex: 1 }}>
                        <View style={{ borderRadius: '8px', overflow: 'hidden' }}>
                          <Image
                            src={inputImageUrl}
                            style={{ width: '100%', height: '120px' }}
                            mode="aspectFill"
                            onClick={() => handlePreviewImage(inputImageUrl)}
                          />
                        </View>
                        <Text className="block text-xs text-center mt-1" style={{ color: '#999999' }}>参考图</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <View style={{ borderRadius: '8px', overflow: 'hidden' }}>
                          <Image
                            src={resultImageUrl}
                            style={{ width: '100%', height: '120px' }}
                            mode="aspectFill"
                            onClick={() => handlePreviewImage(resultImageUrl)}
                          />
                        </View>
                        <Text className="block text-xs text-center mt-1" style={{ color: PRIMARY }}>灵感方案</Text>
                      </View>
                    </View>
                  )}

                  {/* 全尺寸结果 */}
                  <View style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                    <Image
                      src={resultImageUrl}
                      style={{ width: '100%' }}
                      mode="widthFix"
                      onClick={() => handlePreviewImage(resultImageUrl)}
                    />
                  </View>

                  {/* 操作按钮 */}
                  <View style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                    <View style={{ flex: 1 }}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full"
                        style={{ borderColor: PRIMARY, borderRadius: '10px' }}
                        onClick={() => {
                          Taro.saveImageToPhotosAlbum({ filePath: resultImageUrl })
                            .then(() => Taro.showToast({ title: '已保存', icon: 'success' }))
                            .catch(() => Taro.showToast({ title: '保存失败', icon: 'none' }))
                        }}
                      >
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <Save size={14} color={PRIMARY} style={{ marginRight: '4px' }} />
                          <Text style={{ fontSize: '12px', color: PRIMARY }}>保存到相册</Text>
                        </View>
                      </Button>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Button
                        size="sm"
                        className="w-full"
                        style={{ backgroundColor: PRIMARY, borderRadius: '10px' }}
                        onClick={() => handlePreviewImage(resultImageUrl)}
                      >
                        <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                          <Expand size={14} color="#ffffff" style={{ marginRight: '4px' }} />
                          <Text style={{ fontSize: '12px', color: '#ffffff' }}>查看大图</Text>
                        </View>
                      </Button>
                    </View>
                  </View>
                </CardContent>
              </Card>
            )}
          </View>
        )}

        {/* ====== 历史 Tab ====== */}
        {activeTab === 'history' && (
          <View>
            {history.length === 0 ? (
              <Card>
                <CardContent style={{ padding: '40px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <View style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: PRIMARY_FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Shirt size={28} color={PRIMARY_BORDER} />
                  </View>
                  <Text className="block text-sm" style={{ color: '#999999' }}>暂无穿搭灵感记录</Text>
                  <Text className="block text-xs mt-1" style={{ color: '#cccccc' }}>上传参考图或输入主题开始体验</Text>
                  <View style={{ marginTop: '16px' }}>
                    <Button size="sm" style={{ backgroundColor: PRIMARY, borderRadius: '20px', paddingLeft: '24px', paddingRight: '24px' }} onClick={() => setActiveTab('generate')}>
                      <Text style={{ color: '#ffffff', fontSize: '13px' }}>去生成</Text>
                    </Button>
                  </View>
                </CardContent>
              </Card>
            ) : (
              <View style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {history.map((item) => (
                  <Card key={item.id} onClick={() => item.resultImageUrl && handlePreviewImage(item.resultImageUrl)}>
                    <CardContent style={{ padding: '12px' }}>
                      <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                        {/* 输入图缩略图 */}
                        {item.inputImageUrl ? (
                          <Image
                            src={item.inputImageUrl}
                            style={{ width: '52px', height: '52px', borderRadius: '8px', flexShrink: 0 }}
                            mode="aspectFill"
                          />
                        ) : (
                          <View style={{ width: '52px', height: '52px', borderRadius: '8px', backgroundColor: PRIMARY_FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <ImageIcon size={20} color={PRIMARY_BORDER} />
                          </View>
                        )}
                        {/* 信息区 */}
                        <View style={{ flex: 1, marginLeft: '12px', marginRight: '8px', overflow: 'hidden' }}>
                          <Text className="block text-sm font-medium" style={{ color: '#333333' }}>
                            {item.inputText || '穿搭灵感方案'}
                          </Text>
                          <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '4px' }}>
                            <View
                              style={{
                                width: '6px', height: '6px', borderRadius: '50%', marginRight: '6px', flexShrink: 0,
                                backgroundColor: item.status === 'completed' ? '#10B981' : item.status === 'failed' ? '#EF4444' : '#F59E0B',
                              }}
                            />
                            <Text className="block text-xs" style={{ color: '#999999' }}>
                              {item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '生成中'}
                            </Text>
                          </View>
                          <Text className="block text-xs mt-1" style={{ color: '#cccccc' }}>{item.createdAt}</Text>
                        </View>
                        {/* 结果缩略图 */}
                        {item.resultImageUrl && (
                          <Image
                            src={item.resultImageUrl}
                            style={{ width: '44px', height: '44px', borderRadius: '6px', flexShrink: 0 }}
                            mode="aspectFill"
                          />
                        )}
                      </View>
                      {/* 失败记录展示错误信息 */}
                      {item.status === 'failed' && item.errorMessage && (
                        <View style={{ marginTop: '8px', paddingLeft: '64px' }}>
                          <Text className="block text-xs" style={{ color: '#EF4444' }}>{item.errorMessage.slice(0, 60)}</Text>
                        </View>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        <View style={{ height: '40px' }} />
      </ScrollView>
    </View>
  )
}
