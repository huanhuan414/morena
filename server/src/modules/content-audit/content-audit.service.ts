import { Injectable } from '@nestjs/common'

export type ContentAuditItemType = 'text' | 'image' | 'video'

export type ContentAuditItem = {
  type: ContentAuditItemType
  content: string
}

export type ContentAuditPayload = {
  items: ContentAuditItem[]
}

export type ContentAuditResult = {
  passed: boolean
  reason: string
}

@Injectable()
export class ContentAuditService {
  async reviewPorn(payload: ContentAuditPayload | ContentAuditItem[]): Promise<ContentAuditResult> {
    const items = Array.isArray(payload) ? payload : payload?.items
    const validItems = Array.isArray(items)
      ? items.filter(item => item && ['text', 'image', 'video'].includes(item.type) && typeof item.content === 'string' && item.content.trim())
      : []

    if (validItems.length === 0) {
      return { passed: true, reason: '无有效审核内容，默认通过' }
    }

    return { passed: true, reason: '预留鉴黄接口，默认通过' }
  }
}
