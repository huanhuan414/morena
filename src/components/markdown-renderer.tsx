import { View, Text } from '@tarojs/components'

interface MarkdownRendererProps {
  content: string
}

/**
 * 简易 Markdown 渲染器（小程序兼容）
 * 支持：标题、粗体、斜体、列表、链接、分割线、段落
 */
export default function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  const lines = content.split('\n')
  const elements: any[] = []
  let inList = false
  let listItems: string[] = []
  let listType = '' // 'ul' or 'ol'

  const parseInline = (text: string): any[] => {
    const parts: any[] = []
    // 简易行内解析：粗体、斜体、链接、emoji
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(\[(.+?)\]\((.+?)\))|([\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}✨])/gu
    let lastIndex = 0
    let match

    while ((match = regex.exec(text)) !== null) {
      // 普通文本
      if (match.index > lastIndex) {
        const plain = text.slice(lastIndex, match.index)
        if (plain) parts.push(<Text key={parts.length}>{plain}</Text>)
      }

      if (match[1]) {
        // 粗体 **text**
        parts.push(<Text key={parts.length} className="font-bold">{match[2]}</Text>)
      } else if (match[3]) {
        // 斜体 *text*
        parts.push(<Text key={parts.length} className="italic">{match[4]}</Text>)
      } else if (match[5]) {
        // 链接 [text](url)
        parts.push(<Text key={parts.length} className="text-blue-500 underline">{match[6]}</Text>)
      } else if (match[7]) {
        // emoji
        parts.push(<Text key={parts.length}>{match[7]}</Text>)
      }

      lastIndex = match.index + match[0].length
    }

    // 剩余文本
    if (lastIndex < text.length) {
      parts.push(<Text key={parts.length}>{text.slice(lastIndex)}</Text>)
    }

    return parts.length > 0 ? parts : [<Text key={0}>{text}</Text>]
  }

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <View key={elements.length} className="ml-4 mb-2">
          {listItems.map((item, idx) => (
            <View key={idx} className="flex flex-row mb-1">
              <Text className="text-gray-500 mr-2 flex-shrink-0">{listType === 'ol' ? `${idx + 1}.` : '•'}</Text>
              <Text className="text-sm text-gray-700 flex-1">{item.replace(/^[\s]*[-*+]\s*/, '').replace(/^\d+\.\s*/, '')}</Text>
            </View>
          ))}
        </View>
      )
      listItems = []
      inList = false
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // 空行
    if (!line.trim()) {
      flushList()
      continue
    }

    // 分割线
    if (/^---+$/.test(line.trim())) {
      flushList()
      elements.push(<View key={elements.length} className="border-t border-gray-200 my-3" />)
      continue
    }

    // 标题
    const h1Match = line.match(/^#\s+(.+)/)
    const h2Match = line.match(/^##\s+(.+)/)
    const h3Match = line.match(/^###\s+(.+)/)

    if (h1Match) {
      flushList()
      elements.push(
        <Text key={elements.length} className="block text-xl font-bold text-gray-900 mt-4 mb-2">{h1Match[1]}</Text>
      )
      continue
    }
    if (h2Match) {
      flushList()
      elements.push(
        <Text key={elements.length} className="block text-lg font-bold text-gray-800 mt-3 mb-2">{h2Match[1]}</Text>
      )
      continue
    }
    if (h3Match) {
      flushList()
      elements.push(
        <Text key={elements.length} className="block text-base font-semibold text-gray-800 mt-2 mb-1">{h3Match[1]}</Text>
      )
      continue
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      if (!inList || listType !== 'ul') {
        flushList()
        inList = true
        listType = 'ul'
      }
      listItems.push(line)
      continue
    }

    // 有序列表
    if (/^\s*\d+\.\s+/.test(line)) {
      if (!inList || listType !== 'ol') {
        flushList()
        inList = true
        listType = 'ol'
      }
      listItems.push(line)
      continue
    }

    // 普通段落
    flushList()
    elements.push(
      <Text key={elements.length} className="block text-sm text-gray-700 leading-relaxed mb-2">
        {parseInline(line)}
      </Text>
    )
  }

  flushList()

  return <View>{elements}</View>
}
