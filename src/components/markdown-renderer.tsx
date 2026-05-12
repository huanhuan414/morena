import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'

interface MarkdownRendererProps {
  content: string
}

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
    // 图片行：![alt](url)
    else if (line.trim().match(/^!\[.*?\]\(.*?\)$/)) {
      const match = line.trim().match(/^!\[(.*?)\]\((.*?)\)$/)
      if (match) {
        elements.push({ type: 'img', alt: match[1], url: match[2] })
      }
    }
    // 段落中含行内图片：先分离文本和图片
    else if (line.includes('![') && line.includes('](')) {
      // 将行内图片拆分成多个元素
      const parts = line.split(/(!\[[^\]]*\]\([^)]*\))/g)
      for (const part of parts) {
        if (!part) continue
        const imgMatch = part.match(/^!\[(.*?)\]\((.*?)\)$/)
        if (imgMatch) {
          elements.push({ type: 'img', alt: imgMatch[1], url: imgMatch[2] })
        } else {
          elements.push({ type: 'p', text: part.trim() })
        }
      }
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
        if (el.type === 'img') {
          return (
            <View key={idx} className="md-image-wrapper">
              <Image
                className="md-image"
                src={el.url}
                mode="widthFix"
                onClick={() => {
                  Taro.previewImage({ current: el.url, urls: [el.url] }).catch(() => {})
                }}
              />
              {el.alt ? <Text className="block md-image-caption">{el.alt}</Text> : null}
            </View>
          )
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
