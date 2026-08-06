import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'

import { Badge } from '@/components/ui/badge'

import './index.css'

export type WorkContentViewData = {
  id: number
  category: string
  title: string
  description: string
  images: string[]
  contentTitle: string
  contentText: string
}

type WorkContentViewProps = {
  work: WorkContentViewData
  mode?: 'preview' | 'full'
  onClick?: () => void
}

export function WorkContentView({ work, mode = 'full', onClick }: WorkContentViewProps) {
  const isPreview = mode === 'preview'
  const isGraphic = work.category === '图文'
  const content = work.contentText || work.description || '暂无内容'

  const previewImage = (current: string) => {
    if (isPreview || work.images.length === 0) return
    void Taro.previewImage({ current, urls: work.images })
  }

  const renderContent = () => {
    const hasImageMarker = /\[IMG_\d+\]/.test(content)
    if (hasImageMarker) {
      return content.split(/(\[IMG_\d+\])/g).filter(Boolean).map((part, index) => {
        const imageMatch = part.match(/^\[IMG_(\d+)\]$/)
        if (imageMatch) {
          const imageUrl = work.images[Number(imageMatch[1]) - 1]
          return imageUrl ? (
            <Image
              key={`${work.id}-image-${index}`}
              src={imageUrl}
              mode="widthFix"
              className="wcv-image"
              onClick={() => previewImage(imageUrl)}
            />
          ) : null
        }

        const text = part.trim()
        return text ? (
          <Text key={`${work.id}-text-${index}`} className="wcv-text">
            {text}
          </Text>
        ) : null
      })
    }

    const paragraphs = content.split(/\n+/).map(item => item.trim()).filter(Boolean)
    return (
      <View>
        {paragraphs.map((paragraph, index) => (
          <View key={`${work.id}-paragraph-${index}`}>
            <Text className="wcv-text">{paragraph}</Text>
            {isGraphic && work.images[index] && (
              <Image
                src={work.images[index]}
                mode="widthFix"
                className="wcv-image"
                onClick={() => previewImage(work.images[index])}
              />
            )}
          </View>
        ))}
        {isGraphic && work.images.slice(paragraphs.length).map((imageUrl, index) => (
          <Image
            key={`${imageUrl}-${index}`}
            src={imageUrl}
            mode="widthFix"
            className="wcv-image"
            onClick={() => previewImage(imageUrl)}
          />
        ))}
      </View>
    )
  }

  return (
    <View className={`wcv-card${isPreview ? ' is-preview' : ''}`} onClick={onClick}>
      <View className="wcv-head">
        <Text className="wcv-title">{work.contentTitle || work.title || '无标题作品'}</Text>
        {/* <Badge variant="secondary" className="wcv-type"><Text>{work.category || '作品'}</Text></Badge> */}
      </View>
      {/* {work.description && <Text className="wcv-desc">{work.description}</Text>} */}
      <View className="wcv-body">{renderContent()}</View>
      {isPreview && <Text className="wcv-more">...</Text>}
    </View>
  )
}