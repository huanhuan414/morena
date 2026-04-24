/**
 * Markdown 渲染组件
 * 将 Markdown 转换为美观的小程序组件
 * 🔴 新增：支持自动检测和渲染纯图片/视频 URL
 */

import { View, Text, Image, Video } from '@tarojs/components'
import { useMemo } from 'react'
import Taro from '@tarojs/taro'

interface MarkdownRenderProps {
  content: string
  className?: string
}

interface ParsedBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'blockquote' | 'code' | 'hr' | 'image' | 'video'
  content?: string
  items?: string[]
  language?: string
  url?: string
  alt?: string
}

// 🔴 检测字符串是否是图片 URL
function isImageUrl(text: string): boolean {
  const trimmed = text.trim()
  const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
  if (!isUrl) return false

  const lowerUrl = trimmed.toLowerCase()

  // 1. 检查文件扩展名
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.ico']
  const hasImageExt = imageExtensions.some(ext => lowerUrl.includes(ext))
  if (hasImageExt) return true

  // 2. 检查图片托管服务特征
  const imageHosts = [
    'tos-', 'cdn.', 'img.', 'image.', 'pic.', 'photo.',
    'static.', 'assets.', 'media.', 'file.',
    '51webjs.com', 'ivolces.com', 'volces.com',
    'douyinstatic.com', 'bytedance.com',
    'aliyun', 'qcloud', 'qiniu', 'upyun'
  ]
  const isImageHost = imageHosts.some(host => lowerUrl.includes(host))

  // 3. 检查 URL 路径特征（通常是图片上传后的 UUID 格式）
  // 如: /tos-cn-i-xxx/1777023490389_kdb7mi5t2aa
  const hasImagePathPattern = /\/\d{10,}_[a-z0-9]+$/i.test(trimmed) ||
                               /\/[a-f0-9-]{20,}$/i.test(trimmed)

  // 4. 排除明显的视频链接
  const hasVideoIndicator = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.flv', '.m3u8', 'video', 'vod'].some(ext => lowerUrl.includes(ext))
  if (hasVideoIndicator) return false

  return isImageHost || hasImagePathPattern
}

// 🔴 检测字符串是否是视频 URL
function isVideoUrl(text: string): boolean {
  const trimmed = text.trim()
  const isUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
  if (!isUrl) return false

  const lowerUrl = trimmed.toLowerCase()

  // 1. 检查文件扩展名
  const videoExtensions = ['.mp4', '.mov', '.webm', '.avi', '.mkv', '.flv', '.m3u8', '.3gp']
  const hasVideoExt = videoExtensions.some(ext => lowerUrl.includes(ext))
  if (hasVideoExt) return true

  // 2. 检查视频托管服务
  const videoHosts = ['video', 'vod', 'player', 'stream', 'live', 'play']
  const isVideoHost = videoHosts.some(host => lowerUrl.includes(host))

  return isVideoHost
}

// 解析 Markdown 为块级元素
function parseMarkdown(markdown: string): ParsedBlock[] {
  const blocks: ParsedBlock[] = []
  const lines = markdown.split('\n')
  
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    
    // 跳过空行
    if (!line.trim()) {
      i++
      continue
    }
    
    // 标题
    if (line.startsWith('# ')) {
      blocks.push({ type: 'h1', content: line.slice(2).trim() })
      i++
      continue
    }
    if (line.startsWith('## ')) {
      blocks.push({ type: 'h2', content: line.slice(3).trim() })
      i++
      continue
    }
    if (line.startsWith('### ')) {
      blocks.push({ type: 'h3', content: line.slice(4).trim() })
      i++
      continue
    }
    
    // 分隔线
    if (line.match(/^[-*_]{3,}$/)) {
      blocks.push({ type: 'hr' })
      i++
      continue
    }
    
    // 引用
    if (line.startsWith('> ')) {
      blocks.push({ type: 'blockquote', content: line.slice(2).trim() })
      i++
      continue
    }
    
    // 代码块
    if (line.startsWith('```')) {
      const language = line.slice(3).trim() || 'text'
      const codeLines: string[] = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i])
        i++
      }
      i++ // 跳过结束的 ```
      blocks.push({ type: 'code', content: codeLines.join('\n'), language })
      continue
    }
    
    // 图片 (Markdown 语法)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      blocks.push({ type: 'image', alt: imgMatch[1], url: imgMatch[2] })
      i++
      continue
    }

    // 🔴 新增：检测纯图片 URL 行
    if (isImageUrl(line)) {
      blocks.push({ type: 'image', alt: '', url: line.trim() })
      i++
      continue
    }

    // 🔴 新增：检测纯视频 URL 行
    if (isVideoUrl(line)) {
      blocks.push({ type: 'video', alt: '', url: line.trim() })
      i++
      continue
    }
    
    // 无序列表
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = [line.slice(2).trim()]
      i++
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2).trim())
        i++
      }
      blocks.push({ type: 'ul', items })
      continue
    }
    
    // 有序列表
    const olMatch = line.match(/^(\d+)\.\s+(.*)$/)
    if (olMatch) {
      const items: string[] = [olMatch[2]]
      i++
      while (i < lines.length) {
        const nextMatch = lines[i].match(/^(\d+)\.\s+(.*)$/)
        if (nextMatch) {
          items.push(nextMatch[2])
          i++
        } else {
          break
        }
      }
      blocks.push({ type: 'ol', items })
      continue
    }
    
    // 普通段落
    const paragraphLines: string[] = [line]
    i++
    while (i < lines.length && lines[i].trim() && !lines[i].startsWith('#') && !lines[i].startsWith('-') && !lines[i].startsWith('*') && !lines[i].startsWith('>') && !lines[i].match(/^\d+\./) && !lines[i].match(/^[-*_]{3,}$/)) {
      paragraphLines.push(lines[i])
      i++
    }
    blocks.push({ type: 'p', content: paragraphLines.join('\n') })
  }
  
  return blocks
}

// 渲染行内样式（加粗、斜体、代码、链接）
// 🔴 新增：支持在文本中自动检测和渲染图片/视频 URL
function renderInlineStyles(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIndex = 0

  while (remaining.length > 0) {
    // 🔴 新增：优先检测图片 URL（独立成行或段落）
    const urlRegex = /(https?:\/\/[^\s]+)/
    const urlMatch = remaining.match(urlRegex)

    if (urlMatch) {
      const before = remaining.slice(0, urlMatch.index!)
      const url = urlMatch[1]

      // 处理 URL 前的文本
      if (before) {
        // 递归处理 URL 前的文本
        const beforeParts = renderInlineStylesWithoutUrl(before, keyIndex)
        parts.push(...beforeParts)
        keyIndex += beforeParts.length
      }

      // 🔴 检测是否是图片 URL
      if (isImageUrl(url)) {
        parts.push(
          <View key={keyIndex++} className="my-2">
            <Image
              src={url}
              mode="widthFix"
              className="w-full rounded-lg"
              onClick={() => Taro.previewImage({
                current: url,
                urls: [url]
              })}
            />
          </View>
        )
      }
      // 🔴 检测是否是视频 URL
      else if (isVideoUrl(url)) {
        parts.push(
          <View key={keyIndex++} className="my-2">
            {Taro.getEnv() === Taro.ENV_TYPE.WEB ? (
              <video
                src={url}
                className="w-full rounded-lg"
                controls
                playsInline
                webkit-playsinline="true"
                x5-playsinline="true"
                preload="metadata"
                style={{ width: '100%', height: '180px', borderRadius: '8px', backgroundColor: '#000' }}
              />
            ) : (
              <Video
                src={url}
                className="w-full rounded-lg"
                controls
                showFullscreenBtn
                showPlayBtn
                showCenterPlayBtn
                objectFit="contain"
                style={{ width: '100%', height: '180px', borderRadius: '8px' }}
              />
            )}
          </View>
        )
      }
      // 普通链接
      else {
        parts.push(
          <Text
            key={keyIndex++}
            className="text-blue-500 underline"
            onClick={() => Taro.setClipboardData({ data: url })}
          >
            {url}
          </Text>
        )
      }

      remaining = remaining.slice(urlMatch.index! + urlMatch[0].length)
      continue
    }

    // 没有 URL，处理剩余文本
    const remainingParts = renderInlineStylesWithoutUrl(remaining, keyIndex)
    parts.push(...remainingParts)
    break
  }

  return parts
}

// 🔴 新增：处理不包含 URL 的行内样式
function renderInlineStylesWithoutUrl(text: string, startKey: number): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIndex = startKey

  while (remaining.length > 0) {
    // 加粗
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/)
    if (boldMatch) {
      const before = remaining.slice(0, boldMatch.index!)
      if (before) parts.push(<Text key={keyIndex++}>{before}</Text>)
      parts.push(<Text key={keyIndex++} className="font-bold">{boldMatch[1]}</Text>)
      remaining = remaining.slice(boldMatch.index! + boldMatch[0].length)
      continue
    }

    // 斜体
    const italicMatch = remaining.match(/\*([^*]+)\*/)
    if (italicMatch) {
      const before = remaining.slice(0, italicMatch.index!)
      if (before) parts.push(<Text key={keyIndex++}>{before}</Text>)
      parts.push(<Text key={keyIndex++} className="italic">{italicMatch[1]}</Text>)
      remaining = remaining.slice(italicMatch.index! + italicMatch[0].length)
      continue
    }

    // 行内代码
    const codeMatch = remaining.match(/`([^`]+)`/)
    if (codeMatch) {
      const before = remaining.slice(0, codeMatch.index!)
      if (before) parts.push(<Text key={keyIndex++}>{before}</Text>)
      parts.push(
        <Text key={keyIndex++} className="px-1 py-1 bg-gray-100 rounded text-sm font-mono text-pink-600">
          {codeMatch[1]}
        </Text>
      )
      remaining = remaining.slice(codeMatch.index! + codeMatch[0].length)
      continue
    }

    // 链接 [text](url)
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/)
    if (linkMatch) {
      const before = remaining.slice(0, linkMatch.index!)
      if (before) parts.push(<Text key={keyIndex++}>{before}</Text>)
      parts.push(
        <Text
          key={keyIndex++}
          className="text-blue-500 underline"
          onClick={() => Taro.setClipboardData({ data: linkMatch[2] })}
        >
          {linkMatch[1]}
        </Text>
      )
      remaining = remaining.slice(linkMatch.index! + linkMatch[0].length)
      continue
    }

    // 没有特殊格式，添加剩余文本
    parts.push(<Text key={keyIndex++}>{remaining}</Text>)
    break
  }

  return parts
}

// 渲染单个块
function renderBlock(block: ParsedBlock, index: number): React.ReactNode {
  switch (block.type) {
    case 'h1':
      return (
        <Text key={index} className="block text-2xl font-bold text-gray-900 mb-4 mt-6 first:mt-0">
          {block.content}
        </Text>
      )
    
    case 'h2':
      return (
        <Text key={index} className="block text-xl font-bold text-gray-800 mb-3 mt-5">
          {block.content}
        </Text>
      )
    
    case 'h3':
      return (
        <Text key={index} className="block text-lg font-semibold text-gray-800 mb-2 mt-4">
          {block.content}
        </Text>
      )
    
    case 'p':
      return (
        <Text key={index} className="block text-base text-gray-700 leading-relaxed mb-3">
          {renderInlineStyles(block.content || '')}
        </Text>
      )
    
    case 'blockquote':
      return (
        <View key={index} className="border-l-4 border-blue-400 pl-4 py-2 my-3 bg-blue-50 rounded-r">
          <Text className="text-gray-600 italic">{block.content}</Text>
        </View>
      )
    
    case 'ul':
      return (
        <View key={index} className="my-3">
          {block.items?.map((item, idx) => (
            <View key={idx} className="flex flex-row items-start mb-2">
              <Text className="text-gray-400 mr-2">•</Text>
              <Text className="flex-1 text-gray-700">{renderInlineStyles(item)}</Text>
            </View>
          ))}
        </View>
      )
    
    case 'ol':
      return (
        <View key={index} className="my-3">
          {block.items?.map((item, idx) => (
            <View key={idx} className="flex flex-row items-start mb-2">
              <Text className="text-gray-500 mr-2 min-w-[20px]">{idx + 1}.</Text>
              <Text className="flex-1 text-gray-700">{renderInlineStyles(item)}</Text>
            </View>
          ))}
        </View>
      )
    
    case 'code':
      return (
        <View key={index} className="my-3 bg-gray-900 rounded-lg overflow-hidden">
          {block.language && (
            <View className="px-3 py-1 bg-gray-800 border-b border-gray-700">
              <Text className="text-xs text-gray-400">{block.language}</Text>
            </View>
          )}
          <View className="p-3 overflow-x-auto">
            <Text className="text-sm text-gray-100 font-mono whitespace-pre">{block.content}</Text>
          </View>
        </View>
      )
    
    case 'hr':
      return <View key={index} className="my-6 border-t border-gray-200" />
    
    case 'image':
      return (
        <View key={index} className="my-3">
          <Image
            src={block.url || ''}
            mode="widthFix"
            className="w-full rounded-lg"
            onClick={() => Taro.previewImage({
              current: block.url,
              urls: [block.url || '']
            })}
          />
          {/* 只有当 alt 文本简短且不是 URL 时才显示，避免显示长链接 */}
          {block.alt && !block.alt.startsWith('http') && block.alt.length < 50 && (
            <Text className="text-sm text-gray-500 text-center mt-1">{block.alt}</Text>
          )}
        </View>
      )

    // 🔴 新增：视频渲染
    case 'video':
      return (
        <View key={index} className="my-3">
          {Taro.getEnv() === Taro.ENV_TYPE.WEB ? (
            <video
              src={block.url || ''}
              className="w-full rounded-lg"
              controls
              playsInline
              webkit-playsinline="true"
              x5-playsinline="true"
              preload="metadata"
              style={{ width: '100%', height: '200px', borderRadius: '8px', backgroundColor: '#000' }}
            />
          ) : (
            <Video
              src={block.url || ''}
              className="w-full rounded-lg"
              controls
              showFullscreenBtn
              showPlayBtn
              showCenterPlayBtn
              objectFit="contain"
              style={{ width: '100%', height: '200px', borderRadius: '8px' }}
            />
          )}
        </View>
      )

    default:
      return null
  }
}

export default function MarkdownRender({ content, className = '' }: MarkdownRenderProps) {
  const blocks = useMemo(() => parseMarkdown(content), [content])
  
  return (
    <View className={`markdown-render ${className}`}>
      {blocks.map((block, index) => renderBlock(block, index))}
    </View>
  )
}
