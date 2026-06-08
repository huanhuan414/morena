import { toNumber } from '@/utils/format'

export interface TimelineEventDto {
  id: string
  eventType: string
  title: string
  createdAt: string
}

export interface AvatarPublishFeedbackDto {
  publishUrl?: string
  publishTime?: string
  views?: number
  likes?: number
  comments?: number
  remark?: string
  images?: string[]
  [key: string]: any
}

export interface AvatarStatDto {
  requestId: string | null
  avatarId: string
  avatarName: string
  avatarUrl: string
  phone: string | null
  status: string
  rejectReason: string | null
  contentType: string
  content: string
  images: string[]
  videoUrls: string[]
  contentUpdatedAt: string | null
  publishFeedback: Record<string, AvatarPublishFeedbackDto>
  createdAt: string
  updatedAt: string | null
  acceptedAt: string | null
}

export interface OrderSummaryStatsDto {
  totalAvatars: number
  acceptedAvatars: number
  completedAvatars: number
  pendingAvatars: number
  rejectedAvatars: number
}

export interface OrderDetailDto {
  id: string
  userId: string
  title: string
  description: string
  contentType: string
  platforms: string[]
  budget: number
  status: string
  isPaid: boolean
  createdAt: string
  avatarCount: number
  avatarStats: AvatarStatDto[]
  summaryStats: OrderSummaryStatsDto
}

export interface OrderProcessingData {
  requestId: string
  orderId: string
  avatarId: string
  status: string
  publishFeedback?: Record<string, AvatarPublishFeedbackDto>
  generatedContent?: {
    content?: string
    images?: string[]
    videos?: string[]
    platforms?: string[]
  } | null
}

export interface EarningOverview {
  balance: number
  totalEarnings: number
  completedAmount: number
  settlingAmount: number
  pendingAmount: number
  processingAmount: number
  monthlyAmount: number
  totalOrders: number
  totalReferrals: number
}

export interface EarningRecord {
  id: string
  amount: number           // 实际到账金额
  feeRate: number          // 抽成比例（0.20表示20%）
  feeAmount: number        // 抽成金额
  type: string
  status: string
  createdAt: string
  description: string
}

function parseStringArray(value: any): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }

  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
      : (value ? [value] : [])
  } catch {
    return value ? [value] : []
  }
}

function asRecord(value: any): Record<string, any> | null {
  return value && typeof value === 'object' ? value as Record<string, any> : null
}

function normalizePublishFeedback(raw: any): Record<string, AvatarPublishFeedbackDto> {
  const source = asRecord(raw)
  if (!source) return {}

  return Object.entries(source).reduce<Record<string, AvatarPublishFeedbackDto>>((acc, [key, value]) => {
    if (key === 'rejectReason' || key === 'reject_reason') return acc

    const item = asRecord(value)
    if (!item) {
      acc[key] = {}
      return acc
    }

    acc[key] = {
      ...item,
      publishUrl: item.publishUrl || item.link || '',
      images: parseStringArray(item.images),
    }
    return acc
  }, {})
}

function normalizeAvatarStat(raw: any): AvatarStatDto {
  const source = asRecord(raw) || {}

  return {
    requestId: source.requestId || source.request_id || null,
    avatarId: source.avatarId || source.avatar_id || '',
    avatarName: source.avatarName || source.avatar_name || source.nickname || '',
    avatarUrl: source.avatarUrl || source.avatar_url || '',
    phone: source.phone || null,
    status: source.status || 'pending',
    rejectReason: source.rejectReason || source.reject_reason || null,
    contentType: source.contentType || source.content_type || 'image_text',
    content: source.content || '',
    images: parseStringArray(source.images),
    videoUrls: parseStringArray(source.videoUrls || source.videoUrl || source.video_url),
    contentUpdatedAt: source.contentUpdatedAt || source.content_updated_at || null,
    publishFeedback: normalizePublishFeedback(source.publishFeedback || source.publish_feedback),
    createdAt: source.createdAt || source.created_at || '',
    updatedAt: source.updatedAt || source.updated_at || null,
    acceptedAt: source.acceptedAt || source.accepted_at || null,
  }
}

export function normalizeOrderDetail(raw: any): OrderDetailDto | null {
  const source = asRecord(raw)
  if (!source) return null

  // 兼容字段只允许在 adapter 内只读消费，页面统一读取 canonical DTO。
  const summarySource = asRecord(source.summaryStats || source.summary_stats) || {}
  const avatarSource = Array.isArray(source.avatarStats)
    ? source.avatarStats
    : Array.isArray(summarySource.avatarStats)
      ? summarySource.avatarStats
      : []
  const avatarStats = avatarSource.map(normalizeAvatarStat)

  return {
    id: source.id || '',
    userId: source.userId || source.user_id || '',
    title: source.title || '',
    description: source.description || '',
    contentType: source.contentType || source.content_type || 'text',
    platforms: parseStringArray(source.platforms),
    budget: toNumber(source.budget),
    status: source.status || '',
    isPaid: Boolean(source.isPaid ?? source.is_paid),
    createdAt: source.createdAt || source.created_at || '',
    avatarCount: toNumber(source.avatarCount ?? source.avatar_count ?? avatarStats.length),
    avatarStats,
    summaryStats: {
      totalAvatars: toNumber(summarySource.totalAvatars ?? avatarStats.length),
      acceptedAvatars: toNumber(summarySource.acceptedAvatars),
      completedAvatars: toNumber(summarySource.completedAvatars),
      pendingAvatars: toNumber(summarySource.pendingAvatars),
      rejectedAvatars: toNumber(summarySource.rejectedAvatars),
    },
  }
}

export function normalizeTimelineEvents(raw: any): TimelineEventDto[] {
  const source = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.events)
      ? raw.events
      : []

  return source.map((item: any) => {
    const event = asRecord(item) || {}
    return {
      id: event.id || '',
      eventType: event.eventType || event.event_type || '',
      title: event.title || '',
      createdAt: event.createdAt || event.created_at || '',
    }
  })
}

export function normalizeOrderProcessingStatus(raw: any): OrderProcessingData | null {
  const source = asRecord(raw)
  if (!source) return null

  return {
    requestId: source.requestId || source.request_id || '',
    orderId: source.orderId || source.order_id || '',
    avatarId: source.avatarId || source.avatar_id || '',
    status: source.status || '',
    publishFeedback: normalizePublishFeedback(source.publishFeedback || source.publish_feedback),
    generatedContent: asRecord(source.generatedContent || source.generated_content),
  }
}

export function normalizeEarningOverview(raw: any): EarningOverview {
  const source = asRecord(raw) || {}

  return {
    balance: toNumber(source.balance),
    totalEarnings: toNumber(source.totalEarnings),
    completedAmount: toNumber(source.completedAmount || source.completed_amount || 0),
    settlingAmount: toNumber(source.settlingAmount || source.settling_amount || 0),
    pendingAmount: toNumber(source.pendingAmount),
    processingAmount: toNumber(source.processingAmount || source.processing_amount || 0),
    monthlyAmount: toNumber(source.monthlyAmount),
    totalOrders: toNumber(source.totalOrders),
    totalReferrals: toNumber(source.totalReferrals),
  }
}

export function normalizeEarningRecords(raw: any): EarningRecord[] {
  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.list)
      ? raw.list
      : []

  return list.map((item: any) => {
    const record = asRecord(item) || {}
    const amount = toNumber(record.amount)
    const feeRate = toNumber(record.feeRate || record.fee_rate || 0)
    // feeAmount 优先从后端获取，如果没有则自己计算：amount * (1 - feeRate)
    const feeAmount = toNumber(record.feeAmount || record.fee_amount) || Number((amount * (1 - feeRate)).toFixed(2))
    
    return {
      id: record.id || '',
      amount: amount,
      feeRate: feeRate,
      feeAmount: feeAmount,
      type: record.type || '',
      status: record.status || '',
      createdAt: record.createdAt || record.created_at || '',
      description: record.description || '',
    }
  })
}
