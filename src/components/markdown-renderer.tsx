import { View, Text } from '@tarojs/components'
import { marked } from 'marked'

interface MarkdownRendererProps {
  content: string
}

// 自定义 renderer 输出 Taro 组件
const renderer = new marked.Renderer()

renderer.heading = function (data) {
  const text = data.text || ''
  const depth = data.depth || 1
  return `<view class="md-heading md-heading-${depth}"><text>${text}</text></view>`
}

renderer.paragraph = function (data) {
  const text = data.text || ''
  return `<view class="md-paragraph"><text>${text}</text></view>`
}

renderer.strong = function (data) {
  const text = data.text || ''
  return `<text class="md-bold">${text}</text>`
}

renderer.em = function (data) {
  const text = data.text || ''
  return `<text class="md-italic">${text}</text>`
}

renderer.listitem = function (data) {
  const text = data.text || ''
  return `<view class="md-list-item"><text>${text}</text></view>`
}

renderer.list = function (data) {
  const items = data.items || []
  return `<view class="md-list">${items.map((item: any) => item.text || '').join('')}</view>`
}

renderer.code = function (data) {
  const text = data.text || ''
  return `<text class="md-code">${text}</text>`
}

renderer.codespan = function (data) {
  const text = data.text || ''
  return `<text class="md-code">${text}</text>`
}

renderer.br = function () {
  return `<text>{'\n'}</text>`
}

marked.setOptions({ renderer })

// 简易 Markdown 解析（不用 dangerouslySetInnerHTML）
function parseMarkdownSimple(content: string) {
  const lines = content.split('\n')
  const elements: any[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (!line.trim()) continue

    // 标题
    if (line.startsWith('### ')) {
      elements.push({ type: 'h3', text: line.slice(4).trim() })
    } else if (line.startsWith('## ')) {
      elements.push({ type: 'h2', text: line.slice(3).trim() })
    } else if (line.startsWith('# ')) {
      elements.push({ type: 'h1', text: line.slice(2).trim() })
    }
    // 列表
    else if (line.match(/^[-*•]\s/)) {
      elements.push({ type: 'li', text: line.replace(/^[-*•]\s/, '').trim() })
    }
    else if (line.match(/^\d+[.)]\s/)) {
      elements.push({ type: 'li', text: line.replace(/^\d+[.)]\s/, '').trim() })
    }
    // 普通段落
    else {
      elements.push({ type: 'p', text: line.trim() })
    }
  }

  return elements
}

// 渲染行内格式（加粗、斜体、标签）
function renderInlineText(text: string) {
  // 处理 **bold**
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|#[^\s#]+[^\s]*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <Text key={idx} className="md-bold">{part.slice(2, -2)}</Text>
    }
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <Text key={idx} className="md-italic">{part.slice(1, -1)}</Text>
    }
    if (part.startsWith('#')) {
      return <Text key={idx} className="md-hashtag">{part}</Text>
    }
    return <Text key={idx}>{part}</Text>
  })
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) return null

  const elements = parseMarkdownSimple(content)

  return (
    <View className="markdown-body">
      {elements.map((el, idx) => {
        if (el.type === 'h1') {
          return <Text key={idx} className="block md-heading md-heading-1">{renderInlineText(el.text)}</Text>
        }
        if (el.type === 'h2') {
          return <Text key={idx} className="block md-heading md-heading-2">{renderInlineText(el.text)}</Text>
        }
        if (el.type === 'h3') {
          return <Text key={idx} className="block md-heading md-heading-3">{renderInlineText(el.text)}</Text>
        }
        if (el.type === 'li') {
          return (
            <View key={idx} className="md-list-item">
              <Text>{renderInlineText(el.text)}</Text>
            </View>
          )
        }
        return <Text key={idx} className="block md-paragraph">{renderInlineText(el.text)}</Text>
      })}
    </View>
  )
}
