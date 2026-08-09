import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'
import { marked } from 'marked'
import type { Token, Tokens } from 'marked'

import './index.css'

export type WorkContentViewData = {
  id: number
  category: string
  title: string
  description: string
  images: string[]
  contentTitle: string
  contentText: string
  contentMarkdown?: string
  contentHtml?: string
}

type WorkContentViewProps = {
  work: WorkContentViewData
  mode?: 'preview' | 'full'
  onClick?: () => void
}

type PreviewImage = (url: string) => void

function getHeadingClass(depth: number) {
  if (depth === 1) return 'wcv-md-h1'
  if (depth === 2) return 'wcv-md-h2'
  return 'wcv-md-h3'
}

function renderInlineTokens(tokens: Token[], keyPrefix: string, previewImage: PreviewImage): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-inline-${index}`

    switch (token.type) {
      case 'image': {
        const image = token as Tokens.Image
        return (
          <Image
            key={key}
            src={image.href}
            mode="widthFix"
            className="wcv-image"
            onClick={() => previewImage(image.href)}
          />
        )
      }
      case 'strong':
        return <Text key={key} className="wcv-md-strong">{renderInlineTokens((token as Tokens.Strong).tokens, key, previewImage)}</Text>
      case 'em':
        return <Text key={key} className="wcv-md-em">{renderInlineTokens((token as Tokens.Em).tokens, key, previewImage)}</Text>
      case 'del':
        return <Text key={key} className="wcv-md-del">{renderInlineTokens((token as Tokens.Del).tokens, key, previewImage)}</Text>
      case 'codespan':
        return <Text key={key} className="wcv-md-code-inline">{(token as Tokens.Codespan).text}</Text>
      case 'link':
        return <Text key={key} className="wcv-md-link">{renderInlineTokens((token as Tokens.Link).tokens, key, previewImage)}</Text>
      case 'br':
        return <Text key={key}>{'\n'}</Text>
      case 'text': {
        const textToken = token as Tokens.Text
        return textToken.tokens?.length
          ? <Text key={key}>{renderInlineTokens(textToken.tokens, key, previewImage)}</Text>
          : <Text key={key}>{textToken.text}</Text>
      }
      default:
        return <Text key={key}>{'text' in token ? String(token.text || '') : ''}</Text>
    }
  })
}

function renderMarkdownTokens(tokens: Token[], keyPrefix: string, previewImage: PreviewImage): ReactNode[] {
  return tokens.map((token, index) => {
    const key = `${keyPrefix}-block-${index}`

    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        return (
          <View key={key} className={getHeadingClass(heading.depth)}>
            {renderInlineTokens(heading.tokens, key, previewImage)}
          </View>
        )
      }
      case 'paragraph': {
        const paragraph = token as Tokens.Paragraph
        return <View key={key} className="wcv-md-paragraph">{renderInlineTokens(paragraph.tokens, key, previewImage)}</View>
      }
      case 'text': {
        const textToken = token as Tokens.Text
        return (
          <View key={key} className="wcv-md-paragraph">
            {textToken.tokens?.length
              ? renderInlineTokens(textToken.tokens, key, previewImage)
              : <Text>{textToken.text}</Text>}
          </View>
        )
      }
      case 'image':
        return renderInlineTokens([token], key, previewImage)[0]
      case 'blockquote':
        return <View key={key} className="wcv-md-quote">{renderMarkdownTokens((token as Tokens.Blockquote).tokens, key, previewImage)}</View>
      case 'list': {
        const list = token as Tokens.List
        const start = Number(list.start || 1)
        return (
          <View key={key} className="wcv-md-list">
            {list.items.map((item, itemIndex) => (
              <View key={`${key}-item-${itemIndex}`} className="wcv-md-list-item">
                <Text className="wcv-md-list-mark">{list.ordered ? `${start + itemIndex}.` : '•'}</Text>
                <View className="wcv-md-list-content">
                  {renderMarkdownTokens(item.tokens, `${key}-item-${itemIndex}`, previewImage)}
                </View>
              </View>
            ))}
          </View>
        )
      }
      case 'code':
        return <View key={key} className="wcv-md-code"><Text>{(token as Tokens.Code).text}</Text></View>
      case 'hr':
        return <View key={key} className="wcv-md-divider" />
      case 'space':
        return null
      default:
        return 'tokens' in token && token.tokens?.length
          ? <View key={key}>{renderMarkdownTokens(token.tokens, key, previewImage)}</View>
          : null
    }
  })
}

export function WorkContentView({ work, mode = 'full', onClick }: WorkContentViewProps) {
  const isPreview = mode === 'preview'
  const isGraphic = work.category === '图文'
  const content = work.contentText || work.description || '暂无内容'
  const markdownTokens = isGraphic && work.contentMarkdown ? marked.lexer(work.contentMarkdown) : []
  const firstToken = markdownTokens[0]
  const hasMarkdownTitle = firstToken?.type === 'heading' && (firstToken as Tokens.Heading).depth === 1

  const previewImage = (current: string) => {
    if (isPreview) return
    const urls = work.images.includes(current) ? work.images : [current, ...work.images]
    void Taro.previewImage({ current, urls })
  }

  const renderLegacyContent = () => {
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
      {!hasMarkdownTitle && (
        <View className="wcv-head">
          <Text className="wcv-title">{work.contentTitle || work.title || '无标题作品'}</Text>
        </View>
      )}
      <View className="wcv-body">
        {markdownTokens.length > 0
          ? renderMarkdownTokens(markdownTokens, `work-${work.id}`, previewImage)
          : renderLegacyContent()}
      </View>
      {isPreview && (
        <View className="wcv-more-row">
          <Text className="wcv-more">...</Text>
        </View>
      )}
    </View>
  )
}
