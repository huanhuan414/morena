import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { ReactNode } from 'react'

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
type TextToken = { type: 'text'; text: string; tokens?: Token[] }
type ImageToken = { type: 'image'; href: string }
type StrongToken = { type: 'strong'; tokens: Token[] }
type EmToken = { type: 'em'; tokens: Token[] }
type DelToken = { type: 'del'; tokens: Token[] }
type CodespanToken = { type: 'codespan'; text: string }
type LinkToken = { type: 'link'; tokens: Token[] }
type BreakToken = { type: 'br' }
type HeadingToken = { type: 'heading'; depth: number; tokens: Token[] }
type ParagraphToken = { type: 'paragraph'; tokens: Token[] }
type BlockquoteToken = { type: 'blockquote'; tokens: Token[] }
type ListToken = { type: 'list'; ordered: boolean; start: number; items: Array<{ tokens: Token[] }> }
type CodeToken = { type: 'code'; text: string }
type MarkerToken = { type: 'hr' | 'space' }

type Token =
  | TextToken
  | ImageToken
  | StrongToken
  | EmToken
  | DelToken
  | CodespanToken
  | LinkToken
  | BreakToken
  | HeadingToken
  | ParagraphToken
  | BlockquoteToken
  | ListToken
  | CodeToken
  | MarkerToken

const INLINE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)\)|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|~~([^~]+)~~|`([^`]+)`|\*([^*]+)\*/g
const HEADING_PATTERN = /^(#{1,6})\s+(.+)$/
const IMAGE_PATTERN = /^!\[([^\]]*)\]\(([^)\s]+)\)$/
const LIST_PATTERN = /^\s*(?:(\d+)[.)]|[-+*])\s+(.+)$/
const DIVIDER_PATTERN = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/

function parseInline(value: string): Token[] {
  const tokens: Token[] = []
  const pattern = new RegExp(INLINE_PATTERN.source, 'g')
  let cursor = 0
  let match = pattern.exec(value)

  while (match) {
    if (match.index > cursor) tokens.push({ type: 'text', text: value.slice(cursor, match.index) })

    if (match[2]) tokens.push({ type: 'image', href: match[2] })
    else if (match[3]) tokens.push({ type: 'link', tokens: parseInline(match[3]) })
    else if (match[5]) tokens.push({ type: 'strong', tokens: parseInline(match[5]) })
    else if (match[6]) tokens.push({ type: 'del', tokens: parseInline(match[6]) })
    else if (match[7]) tokens.push({ type: 'codespan', text: match[7] })
    else if (match[8]) tokens.push({ type: 'em', tokens: parseInline(match[8]) })

    cursor = pattern.lastIndex
    match = pattern.exec(value)
  }

  if (cursor < value.length) tokens.push({ type: 'text', text: value.slice(cursor) })
  return tokens
}

function isBlockStart(line: string) {
  const trimmed = line.trim()
  return !trimmed
    || HEADING_PATTERN.test(trimmed)
    || IMAGE_PATTERN.test(trimmed)
    || trimmed.startsWith('```')
    || trimmed.startsWith('>')
    || LIST_PATTERN.test(line)
    || DIVIDER_PATTERN.test(trimmed)
}

function parseMarkdown(markdown: string): Token[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const tokens: Token[] = []

  for (let index = 0; index < lines.length;) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed) { index += 1; continue }

    const heading = trimmed.match(HEADING_PATTERN)
    if (heading) {
      tokens.push({ type: 'heading', depth: heading[1].length, tokens: parseInline(heading[2]) })
      index += 1
      continue
    }

    const image = trimmed.match(IMAGE_PATTERN)
    if (image) {
      tokens.push({ type: 'image', href: image[2] })
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !lines[index].trim().startsWith('```')) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      tokens.push({ type: 'code', text: code.join('\n') })
      continue
    }

    if (trimmed.startsWith('>')) {
      const quote: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      tokens.push({ type: 'blockquote', tokens: parseMarkdown(quote.join('\n')) })
      continue
    }

    const list = line.match(LIST_PATTERN)
    if (list) {
      const ordered = Boolean(list[1])
      const start = ordered ? Number(list[1]) : 1
      const items: Array<{ tokens: Token[] }> = []
      while (index < lines.length) {
        const item = lines[index].match(LIST_PATTERN)
        if (!item || Boolean(item[1]) !== ordered) break
        items.push({ tokens: [{ type: 'paragraph', tokens: parseInline(item[2]) }] })
        index += 1
      }
      tokens.push({ type: 'list', ordered, start, items })
      continue
    }

    if (DIVIDER_PATTERN.test(trimmed)) {
      tokens.push({ type: 'hr' })
      index += 1
      continue
    }

    const paragraph = [trimmed]
    index += 1
    while (index < lines.length && !isBlockStart(lines[index])) {
      paragraph.push(lines[index].trim())
      index += 1
    }
    tokens.push({ type: 'paragraph', tokens: parseInline(paragraph.join(' ')) })
  }

  return tokens
}

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
        const image = token as ImageToken
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
        return <Text key={key} className="wcv-md-strong">{renderInlineTokens((token as StrongToken).tokens, key, previewImage)}</Text>
      case 'em':
        return <Text key={key} className="wcv-md-em">{renderInlineTokens((token as EmToken).tokens, key, previewImage)}</Text>
      case 'del':
        return <Text key={key} className="wcv-md-del">{renderInlineTokens((token as DelToken).tokens, key, previewImage)}</Text>
      case 'codespan':
        return <Text key={key} className="wcv-md-code-inline">{(token as CodespanToken).text}</Text>
      case 'link':
        return <Text key={key} className="wcv-md-link">{renderInlineTokens((token as LinkToken).tokens, key, previewImage)}</Text>
      case 'br':
        return <Text key={key}>{'\n'}</Text>
      case 'text': {
        const textToken = token as TextToken
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
        const heading = token as HeadingToken
        return (
          <View key={key} className={getHeadingClass(heading.depth)}>
            {renderInlineTokens(heading.tokens, key, previewImage)}
          </View>
        )
      }
      case 'paragraph': {
        const paragraph = token as ParagraphToken
        return <View key={key} className="wcv-md-paragraph">{renderInlineTokens(paragraph.tokens, key, previewImage)}</View>
      }
      case 'text': {
        const textToken = token as TextToken
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
        return <View key={key} className="wcv-md-quote">{renderMarkdownTokens((token as BlockquoteToken).tokens, key, previewImage)}</View>
      case 'list': {
        const list = token as ListToken
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
        return <View key={key} className="wcv-md-code"><Text>{(token as CodeToken).text}</Text></View>
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
  const markdownTokens = isGraphic && work.contentMarkdown ? parseMarkdown(work.contentMarkdown) : []
  const firstToken = markdownTokens[0]
  const hasMarkdownTitle = firstToken?.type === 'heading' && (firstToken as HeadingToken).depth === 1

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
