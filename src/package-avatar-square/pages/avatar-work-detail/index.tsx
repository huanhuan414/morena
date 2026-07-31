import { Image, Text, View } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { ArrowLeft } from 'lucide-react-taro'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Network } from '@/network'
import { getStatusBarHeight } from '@/utils/safe-area'

import './index.css'

type WorkScope = 'public' | 'internal'

type WorkDetail = {
  id: number
  category: string
  title: string
  description: string
  price: string
  images: string[]
  contentTitle: string
  contentText: string
  videoUrl: string
  videoCoverUrl: string
}

export default function AvatarWorkDetailPage() {
  const router = useRouter()
  const workId = router.params.id || ''
  const scope: WorkScope = router.params.scope === 'internal' ? 'internal' : 'public'
  const statusBarHeight = getStatusBarHeight()
  const [work, setWork] = useState<WorkDetail | null>(null)
  const [loading, setLoading] = useState(Boolean(workId))
  const [loadFailed, setLoadFailed] = useState(!workId)

  useEffect(() => {
    if (!workId) return

    let active = true
    const loadWork = async () => {
      setLoading(true)
      setLoadFailed(false)
      try {
        const endpoint = scope === 'internal' ? 'internal-works' : 'public-works'
        const res = await Network.request({
          url: `/api/avatar-square/${endpoint}/${encodeURIComponent(workId)}`,
        })
        console.log('[AvatarWorkDetailPage] work detail response:', res.data)
        const responseBody = res.data as { data?: WorkDetail | null }
        if (!active) return
        if (responseBody?.data) {
          setWork(responseBody.data)
        } else {
          setLoadFailed(true)
        }
      } catch (error) {
        console.error('[AvatarWorkDetailPage] load work detail failed:', error)
        if (active) setLoadFailed(true)
      } finally {
        if (active) setLoading(false)
      }
    }

    void loadWork()
    return () => {
      active = false
    }
  }, [scope, workId])


  const previewImage = (current: string) => {
    if (!work || work.images.length === 0) return
    void Taro.previewImage({ current, urls: work.images })
  }

  const renderContent = () => {
    if (!work) return null

    const hasImageMarker = /\[IMG_\d+\]/.test(work.contentText)
    if (hasImageMarker) {
      return work.contentText.split(/(\[IMG_\d+\])/g).filter(Boolean).map((part, index) => {
        const imageMatch = part.match(/^\[IMG_(\d+)\]$/)
        if (imageMatch) {
          const imageUrl = work.images[Number(imageMatch[1]) - 1]
          return imageUrl ? (
            <Image
              key={`${work.id}-image-${index}`}
              src={imageUrl}
              mode="widthFix"
              className="wd-img"
              onClick={() => previewImage(imageUrl)}
            />
          ) : null
        }

        const text = part.trim()
        return text ? (
          <Text key={`${work.id}-text-${index}`} className="wd-text">
            {text}
          </Text>
        ) : null
      })
    }

    const paragraphs = work.contentText.split(/\n+/).map(item => item.trim()).filter(Boolean)
    return (
      <View>
        {paragraphs.map((paragraph, index) => (
          <View key={`${work.id}-paragraph-${index}`}>
            <Text className="wd-text">
              {paragraph}
            </Text>
            {work.images[index] && (
              <Image
                src={work.images[index]}
                mode="widthFix"
                className="wd-img"
                onClick={() => previewImage(work.images[index])}
              />
            )}
          </View>
        ))}
        {work.images.slice(paragraphs.length).map((imageUrl, index) => (
          <Image
            key={`${imageUrl}-${index}`}
            src={imageUrl}
            mode="widthFix"
            className="wd-img"
            onClick={() => previewImage(imageUrl)}
          />
        ))}
      </View>
    )
  }

  const header = (
    <View className="wd-head">
      <View className="wd-deco" />
      <View className="wd-nav">
        <Button
          variant="outline"
          size="icon"
          className="wd-back"
          onClick={() => Taro.navigateBack()}
        >
          <ArrowLeft size={18} color="#6D4CD8" />
        </Button>
        <Text className="wd-head-title">图文详情</Text>
      </View>
    </View>
  )
  const pageStyle = {
    '--wd-status-top': `${statusBarHeight + 12}px`,
  } as CSSProperties

  let content
  if (loading) {
    content = (
      <View className="wd-load">
        <Skeleton className="wd-skel-title" />
        <Skeleton className="wd-skel-line" />
        <Skeleton className="wd-skel-line is-short" />
        <Skeleton className="wd-skel-img" />
      </View>
    )
  } else if (loadFailed || !work) {
    content = (
      <View className="wd-empty">
        <Text className="wd-empty-text">作品不存在或暂时无法查看</Text>
      </View>
    )
  } else {
    content = (
      <View className="wd-page">
        <Card className="wd-card">
          <CardContent className="wd-body">
            <Text className="wd-title">
              {work.contentTitle || work.title}
            </Text>
            {work.description && (
              <Text className="wd-desc">{work.description}</Text>
            )}
            {renderContent()}
          </CardContent>
        </Card>
      </View>
    )
  }

  return (
    <View className="wd-shell" style={pageStyle}>
      {header}
      {content}
    </View>
  )
}