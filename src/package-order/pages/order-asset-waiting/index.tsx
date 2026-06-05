import { useState, useEffect, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { View, Text, ScrollView, Image, Video } from '@tarojs/components'
import { Network } from '@/network'
import {
  Loader, PackageOpen, CircleCheck, CircleX,
  Users, UserCheck, RefreshCw, Sparkles, ImagePlus, Play,
  ChevronRight, TriangleAlert, FileText
} from 'lucide-react-taro'
import { subscribePolling } from '@/utils/polling'
import './index.css'

interface AssetItem {
  id: string
  asset_type: string
  source: string
  status: string
  asset_url?: string
  original_filename?: string
  assigned_to?: string
}

interface AssetSummary {
  total: number
  ready: number
  generating: number
  failed: number
  images: number
  videos: number
  user_uploaded: number
  ai_generated: number
}

export default function OrderAssetWaiting() {
  const router = useRouter()
  const orderId = router.params.orderId || ''


  const [assets, setAssets] = useState<AssetItem[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [distributeMode, setDistributeMode] = useState<'shared' | 'exclusive'>('shared')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [regenerating, setRegenerating] = useState<string[]>([])
  const [isRegenAll, setIsRegenAll] = useState(false)

  // 订单信息：用于判断 AI 补足需求
  const [aiAutoFill, setAiAutoFill] = useState(false)
  const [contentType, setContentType] = useState('image_text')
  const [requiredImageCount, setRequiredImageCount] = useState(3)
  const [requiredVideoCount, setRequiredVideoCount] = useState(1)
  const [autoFillTriggered, setAutoFillTriggered] = useState(false)
  const [useCustomCopywriting, setUseCustomCopywriting] = useState(false)

  const pollUnsubRef = useRef<(() => void) | null>(null)

  // 平台默认素材数量（仅在AI补齐时用于计算补齐目标）
  const PLATFORM_DEFAULT_IMAGES = 3
  const PLATFORM_DEFAULT_VIDEOS = 1

  const fetchAssets = async (p = 1, append = false) => {
    if (!orderId) return
    try {
      const res = await Network.request({
        url: `/api/order-assets/${orderId}?page=${p}&pageSize=20`,
        method: 'GET',
      })
      const payload = res?.data
      if (payload?.code === 200) {
        const d = payload.data || {}
        const list = d.list || d.items || []
        if (append) {
          setAssets(prev => [...prev, ...list])
        } else {
          setAssets(list)
        }
        setPage(d.page || p)
        setTotalPages(d.totalPages || 1)
      }
    } catch (e) {
      console.error('[AssetWaiting] 获取素材列表失败:', e)
    }
  }

  const fetchSummary = async () => {
    if (!orderId) return
    try {
      const res = await Network.request({
        url: `/api/order-assets/${orderId}/summary`,
        method: 'GET',
      })
      const payload = res?.data
      if (payload?.code === 200) {
        setSummary(payload.data || {})
      }
    } catch (e) {
      console.error('[AssetWaiting] 获取素材概要失败:', e)
    }
  }

  const fetchOrderInfo = async () => {
    if (!orderId) return
    try {
      const res = await Network.request({
        url: `/api/order/${orderId}`,
        method: 'GET',
      })
      const payload = res?.data
      if (payload?.code === 200 && payload?.data) {
        const order = payload.data
        const mode = order.assetDistributeMode || order.asset_distribute_mode || order.requirements?.asset_distribute_mode || 'shared'
        setDistributeMode(mode)
        setContentType(order.contentType || order.content_type || 'image_text')

        // 读取 AI 补足开关
        const reqs = order.requirements || {}
        const autoFill = reqs.ai_auto_fill !== undefined ? reqs.ai_auto_fill : true
        setAiAutoFill(autoFill)

        // 读取自定义文案开关
        setUseCustomCopywriting(!!reqs.use_custom_copywriting && !!reqs.custom_copywriting)

        // 计算素材需求数量
        // 逻辑：
        // - 不开AI补齐：用户上传多少算多少，不需要"达标"到默认数量
        // - 开AI补齐：需要补齐到默认数量（独占模式 × 分身数）
        const isVideo = (order.contentType || order.content_type) === 'video'
        const perAvatarImages = isVideo ? 0 : PLATFORM_DEFAULT_IMAGES
        const perAvatarVideos = isVideo ? PLATFORM_DEFAULT_VIDEOS : 0
        const avatarCount = order.avatarCount || order.avatar_count || order.quantityPerAvatar || 1

        if (autoFill) {
          // AI补齐模式：需要计算目标数量
          if (mode === 'exclusive') {
            setRequiredImageCount(perAvatarImages * avatarCount)
            setRequiredVideoCount(perAvatarVideos * avatarCount)
          } else {
            setRequiredImageCount(perAvatarImages)
            setRequiredVideoCount(perAvatarVideos)
          }
        } else {
          // 非AI补齐模式：用户上传多少就算多少，不需要达标
          // requiredImageCount 设为 0 表示不限制最低数量
          setRequiredImageCount(0)
          setRequiredVideoCount(0)
        }

      }
    } catch (e) {
      console.error('[AssetWaiting] 获取订单信息失败:', e)
    }
  }

  // 自动触发 AI 补足
  const triggerAiAutoFill = async () => {
    if (!orderId || autoFillTriggered) return
    setAutoFillTriggered(true)
    try {
      const res = await Network.request({
        url: '/api/order-assets/generate-for-order',
        method: 'POST',
        data: { orderId },
      })
      const payload = res?.data
      if (payload?.code === 200) {
        // 刷新素材列表
        await fetchAssets(1)
        await fetchSummary()
      }
    } catch (e) {
      console.error('[AssetWaiting] AI补足触发失败:', e)
    }
  }

  // 初始加载 + 轮询
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([fetchAssets(1), fetchSummary(), fetchOrderInfo()])
      setLoading(false)
    }
    loadAll()

    // 轮询刷新（每5秒）
    const unsubscribe = subscribePolling({
      key: `asset-waiting:${orderId}`,
      intervalMs: 5000,
      fetcher: async () => {
        await fetchAssets(1)
        await fetchSummary()
        return true
      },
      onData: () => { },
    })
    pollUnsubRef.current = unsubscribe

    return () => {
      if (pollUnsubRef.current) {
        pollUnsubRef.current()
        pollUnsubRef.current = null
      }
    }
  }, [orderId])

  // 检查是否需要 AI 补足并自动触发
  // 支付回调后端会自动触发 pregenerateOrderAssets，但前端也做兜底检查
  // 后端有防重入锁，重复触发不会重复生成
  useEffect(() => {
    if (loading || !summary || autoFillTriggered) return
    if (contentType === 'text' || contentType === 'simple' || !aiAutoFill) return

    const totalReady = summary.ready || 0
    const totalGenerating = summary.generating || 0
    const totalNeeded = contentType === 'video' ? requiredVideoCount : requiredImageCount + requiredVideoCount
    const needMore = totalReady + totalGenerating < totalNeeded

    if (needMore && totalGenerating === 0) {
      // 素材不足 + 没有正在生成的 → 自动触发（后端有防重入锁，安全）
      triggerAiAutoFill()
    }
  }, [summary, loading, aiAutoFill, contentType, requiredImageCount, requiredVideoCount, autoFillTriggered])

  // 重新生成单个素材
  const handleRegenerate = async (assetId: string) => {
    if (regenerating.includes(assetId)) return
    setRegenerating(prev => [...prev, assetId])
    try {
      const res = await Network.request({
        url: '/api/order-assets/regenerate',
        method: 'POST',
        data: { assetId },
      })
      const payload = res?.data
      if (payload?.code === 200) {
        Taro.showToast({ title: '已提交重新生成', icon: 'success' })
        await fetchAssets(1)
        await fetchSummary()
      } else {
        Taro.showToast({ title: payload?.msg || '重新生成失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[AssetWaiting] 重新生成失败:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setRegenerating(prev => prev.filter(id => id !== assetId))
    }
  }

  // 重新生成全部失败素材 / AI补足 / 无素材时AI生成
  const handleRegenerateAll = async () => {
    if (isRegenAll) return
    setIsRegenAll(true)
    try {
      // 统一调用 generate-for-order，后端会自动判断需要补多少
      const res = await Network.request({
        url: '/api/order-assets/generate-for-order',
        method: 'POST',
        data: { orderId },
      })
      const payload = res?.data
      if (payload?.code === 200) {
        Taro.showToast({ title: 'AI素材生成已提交', icon: 'success' })
        setAutoFillTriggered(false) // 重置，允许再次检查
      } else {
        Taro.showToast({ title: payload?.msg || '操作失败', icon: 'none' })
      }
      await fetchAssets(1)
      await fetchSummary()
    } catch (e) {
      console.error('[AssetWaiting] 操作失败:', e)
      Taro.showToast({ title: '操作失败', icon: 'none' })
    } finally {
      setIsRegenAll(false)
    }
  }

  // 加载更多
  const handleLoadMore = () => {
    if (page < totalPages) {
      fetchAssets(page + 1, true)
    }
  }

  // 预览素材
  const handlePreviewAsset = (asset: any) => {
    if (asset.status !== 'ready' || !asset.asset_url) return
    if (asset.asset_type === 'video') {
      // 视频预览 - 小程序用 previewMedia，H5直接跳转
      if (Taro.getEnv() === Taro.ENV_TYPE.WEAPP || Taro.getEnv() === Taro.ENV_TYPE.TT) {
        Taro.previewMedia({
          sources: [{ url: asset.asset_url, type: 'video' }],
          current: 0,
        }).catch(() => { })
      } else {
        // H5端打开视频链接
        window.open(asset.asset_url, '_blank')
      }
    } else {
      // 图片预览
      const imageAssets = assets.filter(a => a.asset_type === 'image' && a.status === 'ready' && a.asset_url)
      const urls = imageAssets.map(a => a.asset_url).filter((u): u is string => !!u)
      const current = urls.indexOf(asset.asset_url || '')
      Taro.previewImage({
        urls,
        current: current >= 0 ? current : 0,
      }).catch(() => { })
    }
  }

  // 下一步：匹配分身
  const goToMatching = () => {
    if (!orderId) return
    Taro.redirectTo({ url: `/package-order/pages/order-matching/index?orderId=${orderId}` })
  }

  const hasAssets = (summary?.total || 0) > 0
  const isAllReady = hasAssets && (summary?.generating || 0) === 0 && (summary?.failed || 0) === 0
  const hasFailed = (summary?.failed || 0) > 0
  const hasGenerating = (summary?.generating || 0) > 0

  // 纯文字/纯文案类型和简单任务类型不需要素材，始终可以下一步
  const noAssetNeeded = contentType === 'text' || contentType === 'simple'
  // 素材是否充足
  const totalReady = summary?.ready || 0
  const readyImages = summary?.images || 0
  const readyVideos = summary?.videos || 0
  // 不开AI补齐：有素材即可（图片>0 或 视频>0）
  // 开AI补齐：图片达到requiredImageCount 且 视频达到requiredVideoCount
  const isSufficient = noAssetNeeded || (aiAutoFill
    ? (readyImages >= requiredImageCount && readyVideos >= requiredVideoCount)
    : (readyImages > 0 || readyVideos > 0))
  const needMoreImages = (contentType !== 'text' && contentType !== 'video' && contentType !== 'simple' && aiAutoFill) ? Math.max(0, requiredImageCount - readyImages - (summary?.generating || 0)) : 0
  const needMoreVideos = (contentType === 'video' && aiAutoFill) ? Math.max(0, requiredVideoCount - readyVideos - (summary?.generating || 0)) : 0
  const needMoreCount = needMoreImages + needMoreVideos

  return (
    <View className="asset-waiting-page">


      <ScrollView className="aw-body" scrollY>
        {/* 状态概览卡片 */}
        <View className="aw-status-card">
          {loading ? (
            <View className="aw-status-loading">
              <Loader size={24} color="#6366F1" className="aw-spin" />
              <Text className="aw-status-loading-text">加载中...</Text>
            </View>
          ) : !hasAssets ? (
            /* 无素材状态 */
            <View className="aw-status-empty">
              <PackageOpen size={48} color="#94A3B8" />
              <Text className="aw-status-empty-title">暂无素材</Text>
              <Text className="aw-status-empty-desc">
                {aiAutoFill
                  ? 'AI将自动为您生成素材，点击下方按钮开始'
                  : '没有上传素材且未开启AI补足，点击下方按钮生成'}
              </Text>
            </View>
          ) : isSufficient && isAllReady ? (
            /* 素材充足且全部就绪 */
            <View className="aw-status-done">
              <CircleCheck size={32} color="#10B981" />
              <Text className="aw-status-done-title">素材已就绪</Text>
              <Text className="aw-status-done-desc">
                {summary?.images || 0}张图片 · {summary?.videos || 0}个视频
                {summary?.user_uploaded ? ` · ${summary.user_uploaded}个已上传` : ''}
                {summary?.ai_generated ? ` · ${summary.ai_generated}个AI生成` : ''}
              </Text>
              {distributeMode === 'exclusive' && (
                <View className="aw-distribute-badge">
                  <UserCheck size={14} color="#6366F1" />
                  <Text className="aw-distribute-badge-text">独占模式 · 可供{summary?.ready || 0}个分身各领不同素材</Text>
                </View>
              )}
              {distributeMode === 'shared' && hasAssets && (
                <View className="aw-distribute-badge">
                  <Users size={14} color="#10B981" />
                  <Text className="aw-status-badge-text">共享模式 · 所有分身使用相同素材</Text>
                </View>
              )}
            </View>
          ) : hasGenerating ? (
            /* AI生成中 */
            <View className="aw-status-generating">
              <Loader size={32} color="#6366F1" className="aw-spin" />
              <Text className="aw-status-gen-title">AI素材生成中...</Text>
              <Text className="aw-status-gen-desc">
                已就绪 {totalReady}{aiAutoFill ? `/${requiredImageCount + requiredVideoCount}` : ''}，生成中 {summary?.generating || 0}
                {summary?.failed ? `，失败 ${summary.failed}` : ''}
              </Text>
              {/* 进度条 */}
              {aiAutoFill && requiredImageCount > 0 && (
                <View className="aw-progress-bar">
                  <View
                    className="aw-progress-fill"
                    style={{ width: `${Math.min(100, ((summary?.ready || 0) / requiredImageCount) * 100)}%` }}
                  />
                </View>
              )}
            </View>
          ) : hasFailed && !hasGenerating ? (
            /* 有失败素材 */
            <View className="aw-status-failed">
              <CircleX size={32} color="#EF4444" />
              <Text className="aw-status-failed-title">{summary?.failed}个素材生成失败</Text>
              <Text className="aw-status-failed-desc">点击&ldquo;重新生成&rdquo;重试</Text>
            </View>
          ) : summary && needMoreCount > 0 ? (
            /* 素材不足但无生成中 */
            <View className="aw-status-insufficient">
              <TriangleAlert size={32} color="#F59E0B" />
              <Text className="aw-status-insufficient-title">素材不足</Text>
              <Text className="aw-status-insufficient-desc">
                当前{summary.images}张图片{summary.videos > 0 ? `、${summary.videos}个视频` : ''}
                {aiAutoFill && requiredImageCount > 0 ? `，需要${requiredImageCount}张图片${requiredVideoCount > 0 ? `、${requiredVideoCount}个视频` : ''}` : ''}
                {aiAutoFill ? '，AI正在补足' : '，可点击下方按钮补足'}
              </Text>
            </View>
          ) : null}
        </View>

        {/* 素材概要标签 */}
        {hasAssets && !loading && summary && (
          <View className="aw-summary-tags">
            {summary.images > 0 && (
              <View className="aw-tag aw-tag-image">
                <ImagePlus size={12} color="#6366F1" />
                <Text className="aw-tag-text">{summary.images}张图片</Text>
              </View>
            )}
            {summary.videos > 0 && (
              <View className="aw-tag aw-tag-video">
                <Play size={12} color="#8B5CF6" />
                <Text className="aw-tag-text">{summary.videos}个视频</Text>
              </View>
            )}
            {summary.generating > 0 && (
              <View className="aw-tag aw-tag-generating">
                <Sparkles size={12} color="#F59E0B" />
                <Text className="aw-tag-text">{summary.generating}个生成中</Text>
              </View>
            )}
            {summary.failed > 0 && (
              <View className="aw-tag aw-tag-failed">
                <CircleX size={12} color="#EF4444" />
                <Text className="aw-tag-text">{summary.failed}个失败</Text>
              </View>
            )}
            {needMoreCount > 0 && !hasGenerating && (
              <View className="aw-tag aw-tag-need">
                <Sparkles size={12} color="#6366F1" />
                <Text className="aw-tag-text">需补足{needMoreImages > 0 ? `${needMoreImages}张图片` : ''}{needMoreImages > 0 && needMoreVideos > 0 ? '+' : ''}{needMoreVideos > 0 ? `${needMoreVideos}个视频` : ''}</Text>
              </View>
            )}
          </View>
        )}

        {/* 文案生成提示 */}
        {useCustomCopywriting ? (
          <View className="aw-copywriting-hint aw-copywriting-ready">
            <FileText size={14} color="#10B981" />
            <Text className="aw-copywriting-hint-text" style={{ color: '#10B981' }}>文案已就绪（自定义文案，分身将直接使用）</Text>
          </View>
        ) : (
          <View className="aw-copywriting-hint">
            <FileText size={14} color="#94A3B8" />
            <Text className="aw-copywriting-hint-text">文案由分身接单时根据订单内容具体生成</Text>
          </View>
        )}

        {/* 素材网格 */}
        {assets.length > 0 && (
          <View className="aw-assets-section">
            <Text className="aw-section-title">素材列表</Text>
            <View className="aw-assets-grid">
              {assets.map((asset) => (
                <View key={asset.id} className="aw-asset-item" onClick={() => handlePreviewAsset(asset)}>
                  {asset.asset_type === 'video' ? (
                    <View className="aw-asset-video-wrap">
                      {asset.status === 'ready' && asset.asset_url ? (
                        <Video
                          src={asset.asset_url}
                          className="aw-asset-thumb"
                          controls={false}
                          showPlayBtn={false}
                          showCenterPlayBtn={false}
                          showFullscreenBtn={false}
                          autoplay={false}
                          muted
                        />
                      ) : (
                        <View className="aw-asset-thumb aw-asset-placeholder">
                          <Play size={24} color="#94A3B8" />
                        </View>
                      )}
                      <View className="aw-video-play-icon">
                        <Play size={16} color="#fff" />
                      </View>
                      <Text className="aw-video-label">视频</Text>
                    </View>
                  ) : asset.status === 'ready' && asset.asset_url ? (
                    <Image
                      src={asset.asset_url}
                      className="aw-asset-thumb"
                      mode="aspectFill"
                    />
                  ) : (
                    <View className="aw-asset-thumb aw-asset-placeholder">
                      <ImagePlus size={24} color="#94A3B8" />
                    </View>
                  )}
                  {/* 状态标签 */}
                  {asset.status === 'ready' && (
                    <View className="aw-asset-status aw-status-ready">
                      <CircleCheck size={10} color="#10B981" />
                    </View>
                  )}
                  {asset.status === 'generating' && (
                    <View className="aw-asset-status aw-status-gen">
                      <Loader size={10} color="#F59E0B" className="aw-spin" />
                    </View>
                  )}
                  {asset.status === 'failed' && (
                    <View className="aw-asset-status aw-status-fail">
                      <CircleX size={10} color="#EF4444" />
                    </View>
                  )}
                  {/* 失败素材：重新生成按钮 */}
                  {asset.status === 'failed' && (
                    <View
                      className="aw-regenerate-btn"
                      onClick={() => handleRegenerate(asset.id)}
                    >
                      {regenerating.includes(asset.id) ? (
                        <Loader size={10} color="#fff" className="aw-spin" />
                      ) : (
                        <RefreshCw size={10} color="#fff" />
                      )}
                      <Text className="aw-regenerate-text">
                        {regenerating.includes(asset.id) ? '生成中' : '重新生成'}
                      </Text>
                    </View>
                  )}
                  {/* 来源标签 */}
                  <View className="aw-source-tag">
                    <Text className="aw-source-text">
                      {asset.source === 'user_uploaded' ? '已上传' : 'AI生成'}
                    </Text>
                  </View>
                  {/* 可预览提示 */}
                  {asset.status === 'ready' && asset.asset_url && (
                    <View className="aw-preview-hint">
                      <Text className="aw-preview-hint-text">点击预览</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>

            {/* 加载更多 */}
            {page < totalPages && (
              <View className="aw-load-more" onClick={handleLoadMore}>
                <Text className="aw-load-more-text">加载更多</Text>
                <ChevronRight size={14} color="#94A3B8" />
              </View>
            )}
          </View>
        )}

        {/* 底部占位 - 避免固定底栏遮挡内容 */}
        <View style={{ height: '100px' }} />
      </ScrollView>

      {/* 底部操作 - 固定在底部 */}
      <View className="aw-bottom-actions">
        {(noAssetNeeded || (isSufficient && isAllReady)) ? (
          /* 素材充足且全部就绪 → 下一步 */
          <View className="aw-primary-btn" onClick={goToMatching}>
            <Text className="aw-primary-btn-text">下一步：匹配分身</Text>
            <ChevronRight size={16} color="#fff" />
          </View>
        ) : hasGenerating ? (
          /* AI生成中 → 等待 + 重新生成 */
          <>
            <View className="aw-secondary-btn" onClick={goToMatching}>
              <Text className="aw-secondary-btn-text">跳过等待</Text>
            </View>
            <View className="aw-primary-btn aw-primary-btn-waiting">
              <Loader size={14} color="#fff" className="aw-spin" />
              <Text className="aw-primary-btn-text">素材生成中...</Text>
            </View>
          </>
        ) : hasFailed && !hasGenerating ? (
          /* 有失败素材 → 重新生成 */
          <>
            <View className="aw-secondary-btn" onClick={goToMatching}>
              <Text className="aw-secondary-btn-text">直接匹配分身</Text>
            </View>
            <View className="aw-primary-btn" onClick={handleRegenerateAll}>
              {isRegenAll ? <Loader size={14} color="#fff" className="aw-spin" /> : <RefreshCw size={14} color="#fff" />}
              <Text className="aw-primary-btn-text">重新生成</Text>
            </View>
          </>
        ) : !hasAssets ? (
          /* 无素材 → AI生成 */
          <>
            <View className="aw-secondary-btn" onClick={goToMatching}>
              <Text className="aw-secondary-btn-text">跳过</Text>
            </View>
            <View className="aw-primary-btn" onClick={handleRegenerateAll}>
              {isRegenAll ? <Loader size={14} color="#fff" className="aw-spin" /> : <Sparkles size={14} color="#fff" />}
              <Text className="aw-primary-btn-text">AI生成素材</Text>
            </View>
          </>
        ) : (
          /* 素材不足 → 补足 */
          <>
            <View className="aw-secondary-btn" onClick={goToMatching}>
              <Text className="aw-secondary-btn-text">跳过</Text>
            </View>
            <View className="aw-primary-btn" onClick={handleRegenerateAll}>
              {isRegenAll ? <Loader size={14} color="#fff" className="aw-spin" /> : <Sparkles size={14} color="#fff" />}
              <Text className="aw-primary-btn-text">AI补足素材（还需{needMoreCount}张）</Text>
            </View>
          </>
        )}
      </View>
    </View>
  )
}
