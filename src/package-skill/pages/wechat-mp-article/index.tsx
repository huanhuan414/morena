import { useState } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { View, Text, Image, ScrollView, Textarea } from '@tarojs/components'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Network } from '@/network'
import {
  ArrowLeft, Sparkles, History, Trash2,
  Link, ImagePlus, Send, FileText, Loader, X
} from 'lucide-react-taro'
import { getStatusBarHeight } from '@/utils/safe-area'
import { useUserStore } from '@/stores/user'

interface HistoryRecord {
  id: string
  inputImageUrl: string
  inputText: string
  resultImageUrl: string
  status: string
  errorMessage: string
  createdAt: string
  article: { title: string; content: string; images: string[]; inputText: string } | null
}

const PRIMARY = '#1A8CFF'
const PRIMARY_LIGHT = '#4DA6FF'
const PRIMARY_FAINT = '#E8F4FF'
const PRIMARY_BORDER = '#B3D9FF'

export default function WechatMpArticle() {
  const statusBarHeight = getStatusBarHeight()
  const storeAvatarId = useUserStore(state => state.avatarId)
  const [resolvedAvatarId, setResolvedAvatarId] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate')
  const [inputText, setInputText] = useState('')
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genStatus, setGenStatus] = useState<string>('')
  const [genProgress, setGenProgress] = useState<string>('')
  const [genImages, setGenImages] = useState<string[]>([])
  const [result, setResult] = useState<{ title: string; content: string; images: string[] } | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [wechatAccounts, setWechatAccounts] = useState<any[]>([])
  const [pollTimer, setPollTimer] = useState<ReturnType<typeof setInterval> | null>(null)
  const [usageInfo, setUsageInfo] = useState<{ used: number; limit: number; remaining: number }>({ used: 0, limit: 1, remaining: 1 })

  useDidShow(() => {
    fetchHistory()
    fetchWechatAccounts()
    fetchUsageLimit()
    // 恢复进行中的生成状态
    recoverGeneratingStatus()
  })

  const fetchUsageLimit = async () => {
    try {
      const res = await Network.request({
        url: '/api/ai-skill/usage-limit',
        data: { skillType: 'wechat_mp_article' },
      })
      if (res.data?.code === 200 && res.data?.data) {
        setUsageInfo(res.data.data)
      }
    } catch (e) {
      console.error('获取使用限制失败', e)
    }
  }

  // 页面隐藏时不断开轮询（后台继续轮询）
  // useDidHide 中不清理 pollTimer，让轮询继续
  // 但组件卸载时需要清理
  // 注意：Taro 页面不会被卸载，只是隐藏

  const recoverGeneratingStatus = async () => {
    try {
      const res = await Network.request({
        url: '/api/ai-skill/history',
        data: { skillType: 'wechat_mp_article', page: 1, pageSize: 5 },
      })
      if (res.data?.code === 200 && res.data?.data?.list) {
        const records = res.data.data.list as HistoryRecord[]
        const inProgress = records.find(r =>
          r.status === 'generating' || r.status === 'generating_text' || r.status === 'generating_images'
        )
        if (inProgress) {
          setGenerating(true)
          // 恢复已有的图片
          if (inProgress.article?.images?.length) {
            setGenImages(inProgress.article.images)
          }
          startPolling(inProgress.id)
        }
      }
    } catch (err) {
      console.error('[公众号爆款] 恢复状态失败:', err)
    }
  }

  const fetchHistory = async () => {
    try {
      const res = await Network.request({
        url: '/api/ai-skill/history',
        data: { skillType: 'wechat_mp_article', page: 1, pageSize: 20 },
      })
      console.log('[公众号爆款] 历史记录:', res.data)
      if (res.data?.code === 200 && res.data?.data?.list) {
        setHistory(res.data.data.list)
      }
    } catch (err) {
      console.error('[公众号爆款] 获取历史失败:', err)
    }
  }

  // 渲染公众号文章内容 - 图文混排
  const renderArticleContent = (content: string, images: string[]) => {
    if (!content) return null

    // 将 [IMG_N] 占位符替换为特殊标记，然后按段落拆分渲染
    const paragraphs = content.split(/\n+/).filter(p => p.trim())
    
    return (
      <View>
        {paragraphs.map((paragraph, pIdx) => {
          // 检查段落是否包含图片占位符
          const imgMatches = paragraph.match(/\[IMG_(\d+)\]/g)
          
          if (!imgMatches) {
            // 纯文本段落 - 清理HTML标签
            const cleanText = paragraph
              .replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/g, '## $1')
              .replace(/<strong>(.*?)<\/strong>/g, '$1')
              .replace(/<em>(.*?)<\/em>/g, '$1')
              .replace(/<[^>]*>/g, '')
              .replace(/#{1,3}\s/g, '')
              .trim()
            
            if (!cleanText) return null
            
            // 判断是否为标题（通常较短的加粗文本）
            const isHeading = paragraph.match(/<h[1-6]/) || (paragraph.match(/<strong>/) && cleanText.length < 30)
            
            return (
              <Text
                key={pIdx}
                className="block"
                style={{
                  fontSize: isHeading ? '16px' : '15px',
                  fontWeight: isHeading ? '700' : '400',
                  color: '#1A1A2E',
                  lineHeight: '1.8',
                  marginBottom: '8px',
                  marginTop: isHeading ? '12px' : '0',
                }}
              >
                {cleanText}
              </Text>
            )
          }
          
          // 包含图片的段落 - 拆分为文本和图片交替渲染
          const parts = paragraph.split(/(\[IMG_\d+\])/g).filter(Boolean)
          return (
            <View key={pIdx} style={{ marginBottom: '8px' }}>
              {parts.map((part, partIdx) => {
                const imgMatch = part.match(/\[IMG_(\d+)\]/)
                if (imgMatch) {
                  const imgIdx = parseInt(imgMatch[1]) - 1
                  const imgUrl = images[imgIdx]
                  if (imgUrl) {
                    return (
                      <View key={partIdx} style={{ margin: '10px 0' }}>
                        <Image
                          src={imgUrl}
                          style={{ width: '100%', height: '200px', borderRadius: '8px' }}
                          mode="aspectFill"
                          onClick={() => Taro.previewImage({ urls: images, current: imgUrl })}
                        />
                      </View>
                    )
                  }
                  return null
                }
                
                // 文本部分
                const cleanText = part
                  .replace(/<[^>]*>/g, '')
                  .replace(/#{1,3}\s/g, '')
                  .trim()
                
                if (!cleanText) return null
                return (
                  <Text
                    key={partIdx}
                    className="block"
                    style={{ fontSize: '15px', color: '#1A1A2E', lineHeight: '1.8' }}
                  >
                    {cleanText}
                  </Text>
                )
              })}
            </View>
          )
        })}
      </View>
    )
  }

  const fetchWechatAccounts = async () => {
    // 如果没有 avatarId，先从 API 获取用户的第一个分身
    let aid = storeAvatarId || resolvedAvatarId
    if (!aid) {
      try {
        const res = await Network.request({ url: '/api/avatar/list', data: { pageSize: 1 } })
        console.log('[公众号爆款] 分身列表响应:', JSON.stringify(res.data)?.substring(0, 200))
        // 响应格式: {code:200, data:{success:true, data:{list:[...]}}}，需要取 res.data.data.data.list
        const outerData = res.data?.data
        const list = outerData?.data?.list || outerData?.list || (Array.isArray(outerData) ? outerData : [])
        if (Array.isArray(list) && list.length > 0 && list[0].id) {
          aid = list[0].id
          setResolvedAvatarId(aid)
        }
      } catch (err) {
        console.error('[公众号爆款] 获取分身列表失败:', err)
      }
    }
    if (!aid) {
      setWechatAccounts([])
      return
    }
    try {
      const res = await Network.request({
        url: `/api/avatar/${aid}/accounts`,
      })
      console.log('[公众号爆款] 账号列表响应:', JSON.stringify(res.data)?.substring(0, 200))
      if (res.data?.code === 200) {
        const outerData = res.data.data
        const accounts = Array.isArray(outerData) ? outerData : (outerData?.data || outerData?.list || [])
        const filtered = accounts.filter((a: any) => a.platform === 'wechat_mp')
        setWechatAccounts(filtered)
      }
    } catch (err) {
      console.error('[公众号爆款] 获取账号失败:', err)
    }
  }

  const handleChooseImage = async () => {
    if (uploadedImages.length >= 9) {
      Taro.showToast({ title: '最多上传9张图片', icon: 'none' })
      return
    }
    try {
      const res = await Taro.chooseImage({
        count: Math.min(9 - uploadedImages.length, 9),
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
      })
      setUploading(true)
      const newUrls: string[] = []
      for (const tempPath of res.tempFilePaths) {
        try {
          const uploadRes = await Network.uploadFile({
            url: '/api/ai-skill/upload',
            filePath: tempPath,
            name: 'file',
          })
          const data = typeof uploadRes.data === 'string' ? JSON.parse(uploadRes.data) : uploadRes.data
          if (data?.code === 200 && data?.data?.imageUrl) {
            newUrls.push(data.data.imageUrl)
          }
        } catch (err) {
          console.error('[公众号爆款] 上传图片失败:', err)
        }
      }
      setUploadedImages([...uploadedImages, ...newUrls])
      setUploading(false)
    } catch (err) {
      setUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    const newImages = [...uploadedImages]
    newImages.splice(index, 1)
    setUploadedImages(newImages)
  }

  const handleGenerate = async () => {
    if (!inputText.trim()) {
      Taro.showToast({ title: '请输入文章描述', icon: 'none' })
      return
    }

    // 检查今日使用次数
    try {
      const limitRes = await Network.request({ url: '/api/ai-skill/usage-limit?skillType=wechat_mp_article' })
      const limitData = limitRes.data?.data || limitRes.data
      if (limitData && limitData.remaining <= 0) {
        Taro.showToast({ title: '今日使用次数已达上限', icon: 'none' })
        return
      }
    } catch {
      // 查询失败不阻止生成
    }

    setGenerating(true)
    setResult(null)
    setGenStatus('generating_text')
    setGenProgress('正在生成爆款文章...')
    setGenImages([])

    try {
      const res = await Network.request({
        url: '/api/ai-skill/generate',
        method: 'POST',
        data: {
          skillType: 'wechat_mp_article',
          inputText: inputText.trim(),
          inputImageUrls: uploadedImages.length > 0 ? uploadedImages : undefined,
        },
      })
      console.log('[公众号爆款] 生成请求:', res.data)

      if (res.data?.code === 200 && res.data?.data?.id) {
        startPolling(res.data.data.id)
      } else {
        Taro.showToast({ title: res.data?.msg || '生成失败', icon: 'none' })
        setGenerating(false)
        setGenStatus('')
        setGenProgress('')
      }
    } catch (err) {
      Taro.showToast({ title: '请求失败', icon: 'none' })
      setGenerating(false)
      setGenStatus('')
      setGenProgress('')
    }
  }

  const startPolling = (id: string) => {
    // 清理之前的轮询
    if (pollTimer) {
      clearInterval(pollTimer)
    }

    let attempts = 0
    const maxAttempts = 300 // 最多轮询10分钟（3张图可能需要较长时间）

    const timer = setInterval(async () => {
      attempts++
      if (attempts > maxAttempts) {
        clearInterval(timer)
        setPollTimer(null)
        setGenerating(false)
        setGenStatus('timeout')
        setGenProgress('生成超时，请稍后在历史记录中查看')
        return
      }

      try {
        const res = await Network.request({
          url: `/api/ai-skill/record/${id}`,
        })
        const record = res.data?.data
        if (!record) return

        const status = record.status
        const meta = record.metadata || {}

        // 更新状态和进度
        if (status === 'generating_text') {
          setGenStatus('generating_text')
          setGenProgress('正在生成爆款文章...')
        } else if (status === 'generating_images') {
          const imagesSoFar = meta.images || []
          setGenImages(imagesSoFar)
          setGenStatus('generating_images')
          const current = imagesSoFar.length
          const total = meta.totalImages || 3
          setGenProgress(`正在生成配图 (${current}/${total})...`)
        } else if (status === 'completed') {
          clearInterval(timer)
          setPollTimer(null)
          setGenerating(false)
          setGenStatus('completed')
          setGenProgress('生成完成！')
          const images = meta.images || record.article?.images || []
          setGenImages(images)
          if (record.article) {
            setResult({
              title: record.article.title,
              content: record.article.content,
              images,
            })
          }
          fetchHistory()
        } else if (status === 'failed') {
          clearInterval(timer)
          setPollTimer(null)
          setGenerating(false)
          setGenStatus('failed')
          setGenProgress(record.errorMessage || '生成失败')
          Taro.showToast({ title: record.errorMessage || '生成失败', icon: 'none' })
        }
      } catch (err) {
        // 继续轮询
        console.error('[公众号爆款] 轮询异常:', err)
      }
    }, 2000)

    setPollTimer(timer)
  }

  const handlePublish = async () => {
    if (wechatAccounts.length === 0) {
      Taro.showModal({
        title: '需要绑定公众号',
        content: '发布到公众号需要先绑定公众号账号，是否前往绑定？',
        confirmText: '去绑定',
        success: (res) => {
          if (res.confirm) {
            const aid = storeAvatarId || resolvedAvatarId
            Taro.navigateTo({
              url: `/package-avatar/pages/avatar-account-config/index?avatarId=${aid}&platform=wechat_mp`,
            })
          }
        },
      })
      return
    }

    const account = wechatAccounts[0]
    setPublishing(true)

    try {
      const res = await Network.request({
        url: '/api/avatar/publish/wechat-draft',
        method: 'POST',
        data: {
          accountId: account.id,
          title: result?.title || '公众号爆款文章',
          content: result?.content || '',
          imageUrls: result?.images || [],
          digest: result?.content?.substring(0, 60) || '',
        },
      })
      console.log('[公众号爆款] 发布结果:', res.data)
      if (res.data?.code === 200) {
        Taro.showToast({ title: '已发布到草稿箱', icon: 'success' })
      } else {
        Taro.showToast({ title: res.data?.msg || '发布失败', icon: 'none' })
      }
    } catch (err) {
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setPublishing(false)
    }
  }

  const handleDeleteRecord = (id: string) => {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这条记录吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#EF4444',
      success: async (res) => {
        if (res.confirm) {
          try {
            const delRes = await Network.request({
              url: `/api/ai-skill/record/${id}`,
              method: 'DELETE',
            })
            if (delRes.data?.code === 200) {
              Taro.showToast({ title: '已删除', icon: 'success' })
              fetchHistory()
            } else {
              Taro.showToast({ title: delRes.data?.msg || '删除失败', icon: 'none' })
            }
          } catch (err) {
            Taro.showToast({ title: '删除失败', icon: 'none' })
          }
        }
      },
    })
  }

  const handleViewArticle = (item: HistoryRecord) => {
    if (item.article) {
      setResult({
        title: item.article.title,
        content: item.article.content,
        images: item.article.images || [],
      })
      setActiveTab('generate')
    } else if (item.status === 'generating') {
      Taro.showToast({ title: '文章正在生成中...', icon: 'none' })
    }
  }

  return (
    <View className="flex flex-col" style={{ minHeight: '100vh', backgroundColor: '#F5F7FA' }}>
      {/* 自定义导航栏 + 渐变 Header */}
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
        <View style={{ position: 'relative', display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: '16px', height: '32px' }}>
          <View
            style={{ position: 'absolute', left: 0, width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => Taro.navigateBack()}
          >
            <ArrowLeft size={18} color="#ffffff" />
          </View>
          <Text className="text-lg font-bold text-white">公众号爆款生成</Text>
        </View>

        {/* 描述 */}
        <Text className="block text-sm text-white leading-relaxed" style={{ opacity: 0.8, textAlign: 'center' }}>
          输入主题描述，AI 一键生成爆款公众号文章并发布
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
            {/* 文章描述输入 */}
            <Card style={{ marginBottom: '12px' }}>
              <CardContent style={{ padding: '16px' }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '12px' }}>
                  <View style={{ width: '4px', height: '16px', borderRadius: '2px', backgroundColor: PRIMARY, marginRight: '8px' }} />
                  <Text className="block text-sm font-semibold" style={{ color: '#1A1A2E' }}>文章描述</Text>
                </View>
                <View style={{ backgroundColor: '#F5F7FA', borderRadius: '12px', padding: '12px' }}>
                  <Textarea
                    style={{ width: '100%', minHeight: '80px', backgroundColor: 'transparent', fontSize: '14px', lineHeight: '22px' }}
                    placeholder="描述你想生成的公众号文章主题，如：职场沟通技巧、生活小妙招、健康饮食科普..."
                    maxlength={500}
                    value={inputText}
                    onInput={(e) => setInputText(e.detail.value)}
                  />
                </View>
                <Text className="block text-xs mt-2" style={{ color: '#999999', textAlign: 'right' }}>{inputText.length}/500</Text>
              </CardContent>
            </Card>

            {/* 图片上传 */}
            <Card style={{ marginBottom: '12px' }}>
              <CardContent style={{ padding: '16px' }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: '4px', height: '16px', borderRadius: '2px', backgroundColor: PRIMARY, marginRight: '8px' }} />
                    <Text className="block text-sm font-semibold" style={{ color: '#1A1A2E' }}>参考图片</Text>
                  </View>
                  <Text className="block text-xs" style={{ color: '#999999' }}>可选，最多9张</Text>
                </View>

                <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px' }}>
                  {uploadedImages.map((url, index) => (
                    <View key={index} style={{ width: '72px', height: '72px', borderRadius: '8px', overflow: 'hidden', position: 'relative' }}>
                      <Image src={url} style={{ width: '72px', height: '72px' }} mode="aspectFill" />
                      <View
                        style={{
                          position: 'absolute', top: '2px', right: '2px',
                          width: '20px', height: '20px', borderRadius: '50%',
                          backgroundColor: 'rgba(0,0,0,0.5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X size={10} color="#ffffff" />
                      </View>
                    </View>
                  ))}
                  {uploadedImages.length < 9 && (
                    <View
                      style={{
                        width: '72px', height: '72px', borderRadius: '8px',
                        backgroundColor: '#F5F7FA',
                        border: '1px dashed #D0D5DD',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                      }}
                      onClick={handleChooseImage}
                    >
                      {uploading ? (
                        <Loader size={20} color={PRIMARY} />
                      ) : (
                        <>
                          <ImagePlus size={20} color="#999999" />
                          <Text className="block text-xs mt-1" style={{ color: '#999999' }}>添加</Text>
                        </>
                      )}
                    </View>
                  )}
                </View>

                <Text className="block text-xs mt-2" style={{ color: '#999999' }}>
                  {uploadedImages.length === 0
                    ? '不上传图片，AI将自动生成3张配图'
                    : uploadedImages.length < 3
                      ? `已上传${uploadedImages.length}张，AI将补齐至3张`
                      : `已上传${uploadedImages.length}张，AI将插入文章中`}
                </Text>
              </CardContent>
            </Card>

            {/* 账号绑定状态 */}
            <Card style={{ marginBottom: '12px' }}>
              <CardContent style={{ padding: '16px' }}>
                <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: '4px', height: '16px', borderRadius: '2px', backgroundColor: PRIMARY, marginRight: '8px' }} />
                    <Text className="block text-sm font-semibold" style={{ color: '#1A1A2E' }}>公众号绑定</Text>
                  </View>
                  {wechatAccounts.length > 0 ? (
                    <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', marginRight: '6px' }} />
                      <Text className="block text-xs" style={{ color: '#10B981' }}>已绑定：{wechatAccounts[0]?.account_name || '公众号'}</Text>
                    </View>
                  ) : (
                    <View
                      style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY_FAINT, borderRadius: '20px', paddingLeft: '10px', paddingRight: '10px', paddingTop: '4px', paddingBottom: '4px' }}
                      onClick={async () => {
                        let aid = storeAvatarId || resolvedAvatarId
                        if (!aid) {
                          // 先获取分身ID
                          try {
                            const res = await Network.request({ url: '/api/avatar/list', data: { pageSize: 1 } })
                            const outerData = res.data?.data
                            const list = outerData?.data?.list || outerData?.list || (Array.isArray(outerData) ? outerData : [])
                            if (Array.isArray(list) && list.length > 0 && list[0].id) {
                              aid = list[0].id
                              setResolvedAvatarId(aid)
                            }
                          } catch (err) {
                            console.error('[公众号爆款] 获取分身列表失败:', err)
                          }
                        }
                        if (aid) {
                          Taro.navigateTo({ url: `/package-avatar/pages/avatar-account-config/index?avatarId=${aid}&platform=wechat_mp` })
                        } else {
                          Taro.showToast({ title: '请先创建AI分身', icon: 'none' })
                        }
                      }}
                    >
                      <Link size={12} color={PRIMARY} style={{ marginRight: '4px' }} />
                      <Text className="block text-xs" style={{ color: PRIMARY }}>去绑定</Text>
                    </View>
                  )}
                </View>
              </CardContent>
            </Card>

            {/* 生成结果展示 - 公众号文章排版 */}
            {result && (
              <Card style={{ marginBottom: '12px' }}>
                <CardContent style={{ padding: '0' }}>
                  {/* 文章标题 */}
                  <View style={{ padding: '20px 16px 12px', borderBottom: '1px solid #f0f0f0' }}>
                    <Text className="block text-lg font-bold" style={{ color: '#1A1A2E', lineHeight: '1.5' }}>{result.title}</Text>
                  </View>

                  {/* 文章正文 - 图文混排 */}
                  <View style={{ padding: '16px' }}>
                    {renderArticleContent(result.content, result.images)}
                  </View>
                </CardContent>
              </Card>
            )}

            {/* 生成/发布按钮 */}
            <View style={{ marginBottom: '24px' }}>
              {result ? (
                <Button
                  className="w-full"
                  style={{ borderRadius: '12px', height: '48px', backgroundColor: PRIMARY }}
                  onClick={handlePublish}
                  disabled={publishing}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {publishing ? (
                      <Loader size={18} color="#ffffff" style={{ marginRight: '6px' }} />
                    ) : (
                      <Send size={18} color="#ffffff" style={{ marginRight: '6px' }} />
                    )}
                    <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>
                      {publishing ? '发布中...' : '发布到公众号草稿箱'}
                    </Text>
                  </View>
                </Button>
              ) : (
                <Button
                  className="w-full"
                  style={{ borderRadius: '12px', height: '48px', backgroundColor: generating ? '#B3D9FF' : PRIMARY }}
                  onClick={handleGenerate}
                  disabled={generating || !inputText.trim()}
                >
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                    {generating ? (
                      <Loader size={18} color="#ffffff" style={{ marginRight: '6px' }} />
                    ) : (
                      <Sparkles size={18} color="#ffffff" style={{ marginRight: '6px' }} />
                    )}
                    <Text style={{ color: '#ffffff', fontSize: '16px', fontWeight: '600' }}>
                      {generating ? 'AI 生成中...' : '生成爆款文章'}
                    </Text>
                  </View>
                </Button>
              )}
              {!generating && !result && usageInfo?.remaining === 0 && (
                <View className="mt-2 flex justify-center">
                  <Text className="block text-xs text-orange-500">今日使用次数已用完，订阅用户每日可使用3次</Text>
                </View>
              )}
              {!generating && !result && usageInfo?.remaining > 0 && (
                <View className="mt-2 flex justify-center">
                  <Text className="block text-xs text-gray-400">今日剩余 {usageInfo?.remaining} 次使用机会</Text>
                </View>
              )}
            </View>

            {/* 生成中进度提示 */}
            {generating && (
              <View style={{ marginBottom: '24px', backgroundColor: PRIMARY_FAINT, borderRadius: '12px', padding: '16px' }}>
                {/* 状态步骤 */}
                <View style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* 步骤1：文案生成 */}
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                    {genStatus === 'generating_text' ? (
                      <Loader size={16} color={PRIMARY} />
                    ) : genStatus === 'generating_images' || genStatus === 'completed' ? (
                      <View style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: '10px' }}>✓</Text>
                      </View>
                    ) : (
                      <View style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ddd' }} />
                    )}
                    <Text className="block text-sm" style={{ color: genStatus === 'generating_text' ? PRIMARY : (genStatus === 'generating_images' || genStatus === 'completed' ? '#333' : '#999') }}>
                      生成爆款文案
                    </Text>
                  </View>
                  {/* 步骤2：配图生成 */}
                  <View style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px' }}>
                    {genStatus === 'generating_images' ? (
                      <Loader size={16} color={PRIMARY} />
                    ) : genStatus === 'completed' ? (
                      <View style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: PRIMARY, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#fff', fontSize: '10px' }}>✓</Text>
                      </View>
                    ) : (
                      <View style={{ width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#ddd' }} />
                    )}
                    <Text className="block text-sm" style={{ color: genStatus === 'generating_images' ? PRIMARY : (genStatus === 'completed' ? '#333' : '#999') }}>
                      生成配图 {genStatus === 'generating_images' ? `(${genImages.length}/${3})` : ''}
                    </Text>
                  </View>
                </View>
                {/* 进度文字 */}
                <Text className="block text-xs mt-3" style={{ color: '#999' }}>{genProgress}</Text>
                {/* 已生成的图片预览 */}
                {genImages.length > 0 && (
                  <View style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    {genImages.map((url, idx) => (
                      <View key={idx} style={{ width: '80px', height: '80px', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${PRIMARY_BORDER}` }}>
                        <Image src={url} mode="aspectFill" style={{ width: '100%', height: '100%' }} />
                      </View>
                    ))}
                  </View>
                )}
              </View>
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
                    <FileText size={28} color={PRIMARY_BORDER} />
                  </View>
                  <Text className="block text-sm" style={{ color: '#999999' }}>暂无生成记录</Text>
                  <Text className="block text-xs mt-1" style={{ color: '#cccccc' }}>输入主题开始创作爆款文章</Text>
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
                  <Card key={item.id}>
                    <CardContent style={{ padding: '12px' }}>
                      <View
                        style={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}
                        onClick={() => handleViewArticle(item)}
                      >
                        {/* 文章图标 */}
                        <View style={{ width: '52px', height: '52px', borderRadius: '8px', backgroundColor: PRIMARY_FAINT, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <FileText size={22} color={PRIMARY} />
                        </View>
                        {/* 信息区 */}
                        <View style={{ flex: 1, marginLeft: '12px', marginRight: '8px', overflow: 'hidden' }}>
                          <Text className="block text-sm font-medium" style={{ color: '#333333' }}>
                            {item.article?.title || item.inputText?.substring(0, 30) || '公众号文章'}
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
                        {/* 删除按钮 */}
                        <View
                          style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                          onClick={(e) => { e.stopPropagation && e.stopPropagation(); handleDeleteRecord(item.id); }}
                        >
                          <Trash2 size={14} color="#EF4444" />
                        </View>
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
