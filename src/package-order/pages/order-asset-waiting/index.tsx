import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import {
  ArrowLeft, RefreshCw, CircleCheck, Loader, CircleX,
  Play, Sparkles, ChevronRight, ImagePlus
} from 'lucide-react-taro'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'
import { subscribePolling } from '@/utils/polling'
import './index.css'

interface AssetItem {
  id: string
  asset_type: string
  source: string
  asset_url: string
  status: string
  original_filename?: string
  prompt?: string
  created_at: string
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
  const [assets, setAssets] = useState<AssetItem[]>([])
  const [summary, setSummary] = useState<AssetSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState<string[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const pollUnsubRef = useRef<(() => void) | null>(null)
  const statusBarHeight = getStatusBarHeight()

  const orderId = (() => {
    const inst = Taro.getCurrentInstance()
    return inst?.router?.params?.orderId || ''
  })()

  // 加载素材列表
  const fetchAssets = async (pageNum: number = 1, append: boolean = false) => {
    if (!orderId) return
    try {
      const res = await Network.request({
        url: `/api/order-assets/${orderId}`,
        method: 'GET',
        data: { page: pageNum, pageSize: 20 },
      })
      const payload = res?.data
      const data = payload?.data
      if (payload?.code === 200 && data) {
        const items = (data.items || []) as AssetItem[]
        if (append) {
          setAssets(prev => [...prev, ...items])
        } else {
          setAssets(items)
        }
        setTotalPages(data.totalPages || 1)
        setPage(pageNum)
      }
    } catch (e) {
      console.error('[AssetWaiting] 获取素材列表失败:', e)
    }
  }

  // 加载概要
  const fetchSummary = async () => {
    if (!orderId) return
    try {
      const res = await Network.request({
        url: `/api/order-assets/${orderId}/summary`,
        method: 'GET',
      })
      const payload = res?.data
      if (payload?.code === 200 && payload?.data) {
        setSummary(payload.data as AssetSummary)
      }
    } catch (e) {
      console.error('[AssetWaiting] 获取概要失败:', e)
    }
  }

  // 初始加载 + 轮询
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true)
      await Promise.all([fetchAssets(1), fetchSummary()])
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
      onData: () => {},
    })
    pollUnsubRef.current = unsubscribe

    return () => {
      if (pollUnsubRef.current) {
        pollUnsubRef.current()
        pollUnsubRef.current = null
      }
    }
  }, [orderId])

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
        // 刷新列表
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

  // 加载更多
  const handleLoadMore = () => {
    if (page < totalPages) {
      fetchAssets(page + 1, true)
    }
  }

  // 去订单详情
  const goToOrderDetail = () => {
    if (!orderId) return
    Taro.redirectTo({ url: `/package-order/pages/order-detail/index?id=${orderId}` })
  }

  const isAllReady = summary && summary.total > 0 && summary.generating === 0 && summary.failed === 0
  const hasFailed = summary && summary.failed > 0

  return (
    <View className="asset-waiting-page">
      {/* 顶部 */}
      <View className="aw-header" style={{ paddingTop: `${statusBarHeight + 16}px` }}>
        <View className="aw-header-row">
          <View className="aw-back-btn" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={20} color="#fff" />
          </View>
          <Text className="aw-header-title">素材准备</Text>
          <View className="aw-header-action" onClick={goToOrderDetail}>
            <Text className="aw-header-action-text">查看订单</Text>
          </View>
        </View>
      </View>

      <ScrollView className="aw-body" scrollY>
        {/* 状态概览卡片 */}
        <View className="aw-status-card">
          {loading ? (
            <View className="aw-status-loading">
              <Loader size={24} color="#6366F1" className="aw-spin" />
              <Text className="aw-status-loading-text">加载中...</Text>
            </View>
          ) : isAllReady ? (
            <View className="aw-status-done">
              <CircleCheck size={32} color="#10B981" />
              <Text className="aw-status-done-title">素材已就绪</Text>
              <Text className="aw-status-done-desc">
                {summary?.images || 0}张图片 · {summary?.videos || 0}个视频
                {summary?.user_uploaded ? ` · ${summary.user_uploaded}个已上传` : ''}
                {summary?.ai_generated ? ` · ${summary.ai_generated}个AI生成` : ''}
              </Text>
            </View>
          ) : hasFailed ? (
            <View className="aw-status-failed">
              <CircleX size={32} color="#EF4444" />
              <Text className="aw-status-failed-title">{summary?.failed}个素材生成失败</Text>
              <Text className="aw-status-failed-desc">点击失败素材的重新生成按钮重试</Text>
            </View>
          ) : (
            <View className="aw-status-generating">
              <Loader size={32} color="#6366F1" className="aw-spin" />
              <Text className="aw-status-gen-title">AI素材生成中...</Text>
              <Text className="aw-status-gen-desc">
                已就绪 {summary?.ready || 0}/{summary?.total || 0}，生成中 {summary?.generating || 0}
              </Text>
              {/* 进度条 */}
              <View className="aw-progress-bar">
                <View
                  className="aw-progress-fill"
                  style={{ width: summary?.total ? `${((summary?.ready || 0) / summary.total) * 100}%` : '0%' }}
                />
              </View>
            </View>
          )}
        </View>

        {/* 素材概要标签 */}
        {summary && !loading && (
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
          </View>
        )}

        {/* 素材网格 */}
        {assets.length > 0 && (
          <View className="aw-assets-section">
            <Text className="aw-section-title">素材列表</Text>
            <View className="aw-assets-grid">
              {assets.map((asset) => (
                <View key={asset.id} className="aw-asset-item">
                  {asset.asset_type === 'video' ? (
                    <View className="aw-asset-video-wrap">
                      <Image
                        src={asset.asset_url}
                        className="aw-asset-thumb"
                        mode="aspectFill"
                      />
                      <View className="aw-video-play-icon">
                        <Play size={16} color="#fff" />
                      </View>
                      <Text className="aw-video-label">视频</Text>
                    </View>
                  ) : (
                    <Image
                      src={asset.asset_url}
                      className="aw-asset-thumb"
                      mode="aspectFill"
                    />
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

        {/* 底部操作 */}
        <View className="aw-bottom-actions">
          {isAllReady ? (
            <View className="aw-primary-btn" onClick={goToOrderDetail}>
              <Text className="aw-primary-btn-text">素材已就绪，查看订单</Text>
            </View>
          ) : (
            <>
              <View className="aw-secondary-btn" onClick={goToOrderDetail}>
                <Text className="aw-secondary-btn-text">稍后查看</Text>
              </View>
              <View className="aw-primary-btn aw-primary-btn-waiting" onClick={() => {}}>
                <Loader size={14} color="#fff" className="aw-spin" />
                <Text className="aw-primary-btn-text">等待生成完成</Text>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
