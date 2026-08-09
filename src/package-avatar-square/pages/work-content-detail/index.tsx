import { ScrollView, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft, Copy, Sparkles } from 'lucide-react-taro'

import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { WorkContentView, type WorkContentViewData } from '../../components/work-content-view'

import './index.css'

export default function WorkContentDetailPage() {
  const router = useRouter()
  const workId = router.params.id || ''
  const [work, setWork] = useState<WorkContentViewData | null>(null)
  const [loading, setLoading] = useState(Boolean(workId))
  const [loadFailed, setLoadFailed] = useState(!workId)
  const statusBarHeight = Taro.getWindowInfo().statusBarHeight || 20
  const pageStyle = {
    '--wcd-status-height': `${statusBarHeight}px`,
  } as CSSProperties

  useEffect(() => {
    if (!workId) return

    let active = true
    const loadDetail = async () => {
      setLoading(true)
      setLoadFailed(false)
      try {
        const res = await Network.request({
          url: `/api/avatar-square/work-square/${encodeURIComponent(workId)}`,
        })
        const responseBody = res.data as { data?: WorkContentViewData | null }
        if (!active) return
        if (responseBody?.data) {
          setWork(responseBody.data)
        } else {
          setLoadFailed(true)
        }
      } catch (error) {
        console.error('[WorkContentDetailPage] load detail failed:', error)
        if (active) setLoadFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadDetail()
    return () => {
      active = false
    }
  }, [workId])

  const title = work?.category === '文字' ? '文字详情' : '图文详情'

  const copyContent = (content: string, label: string) => {
    if (!content) {
      void Taro.showToast({ title: `暂无${label}内容`, icon: 'none' })
      return
    }

    void Taro.setClipboardData({
      data: content,
      success: () => Taro.showToast({ title: `${label}已复制`, icon: 'success' }),
    })
  }

  let body
  if (loading) {
    body = (
      <View className="wcd-loading">
        <Skeleton className="wcd-skeleton-title" />
        <Skeleton className="wcd-skeleton-line" />
        <Skeleton className="wcd-skeleton-line is-short" />
        <Skeleton className="wcd-skeleton-image" />
      </View>
    )
  } else if (loadFailed || !work) {
    body = (
      <View className="wcd-empty">
        <Sparkles size={42} color="#C4B5FD" />
        <Text className="wcd-empty-text">作品不存在或暂时无法查看</Text>
      </View>
    )
  } else {
    const isGraphic = work.category === '图文'
    const textTitle = work.contentTitle || work.title || '无标题作品'
    const textBody = work.contentText || work.description || '暂无内容'
    const textCopyContent = `${textTitle}\n\n${textBody}`

    body = (
      <View className="wcd-content">
        <WorkContentView work={work} mode="full" />
        {isGraphic ? (
          <View className="wcd-copy-actions">
            <Button variant="outline" className="wcd-copy-btn" onClick={() => copyContent(work.contentMarkdown || '', 'Markdown')}>
              <Copy size={15} color="#7C3AED" />
              <Text>Markdown复制</Text>
            </Button>
            <Button variant="outline" className="wcd-copy-btn" onClick={() => copyContent(work.contentHtml || '', 'HTML')}>
              <Copy size={15} color="#7C3AED" />
              <Text>HTML复制</Text>
            </Button>
          </View>
        ) : (
          <View className="wcd-text-copy-actions">
            <Button
              variant="outline"
              className="wcd-copy-btn wcd-text-copy-btn"
              onClick={() => copyContent(textCopyContent, '内容')}
            >
              <Copy size={15} color="#7C3AED" />
              <Text>内容复制</Text>
            </Button>
          </View>
        )}
      </View>
    )
  }

  return (
    <View className="wcd-page" style={pageStyle}>
      <View className="wcd-header">
        <View className="wcd-deco" />
        <View className="wcd-nav">
          <Button variant="outline" size="icon" className="wcd-back" onClick={() => Taro.navigateBack()}>
            <ArrowLeft size={18} color="#6D4CD8" />
          </Button>
          <Text className="wcd-head-title">{title}</Text>
        </View>
      </View>
      <ScrollView scrollY className="wcd-scroll">
        {body}
      </ScrollView>
    </View>
  )
}
