/**
 * Markdown 渲染组件
 * 将 Markdown 转换为美观的小程序组件
 */

import { View, Text, Image } from '@tarojs/components'
import { useMemo } from 'react'
import Taro from '@tarojs/taro'

interface MarkdownRenderProps {
  content: string
  className?: string
}

interface ParsedBlock {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'blockquote' | 'code' | 'hr' | 'image'
  content?: string
  items?: string[]
  language?: string
  url?: string
  alt?: string
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
    
    // 图片
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgMatch) {
      blocks.push({ type: 'image', alt: imgMatch[1], url: imgMatch[2] })
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
function renderInlineStyles(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  let remaining = text
  let keyIndex = 0
  
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
    
    // 链接
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
          {block.alt && (
            <Text className="text-sm text-gray-500 text-center mt-1">{block.alt}</Text>
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
