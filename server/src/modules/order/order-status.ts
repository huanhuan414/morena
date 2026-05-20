export const FULFILLMENT_STATUSES = [
  'queuing',
  'generating',
  'preview',
  'publishing',
  'published',
  'awaiting_acceptance',
  'revision_requested',
  'settled',
  'failed',
  'partial_failed',
] as const

export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number]

export const DISPATCH_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
  'timeout',
  'completed',
  'settled',
  'done',
] as const

export type DispatchStatus = (typeof DISPATCH_STATUSES)[number]

export const ORDER_STATUSES = [
  'pending_payment',
  'open',
  // 已支付待接单（旧口径/兼容口径）
  'pending',
  'pending_dispatch',
  'pending_acceptance',
  // 少数流程会直接写入（兼容口径）
  'accepted',
  'in_progress',
  // 内容生成/发布流程（兼容旧实现）
  'content_generated',
  'submitted',
  'published',
  'awaiting_acceptance',
  'revision_requested',
  'publish_failed',
  'publish_timeout',
  'completed',
  'cancelled',
  'rejected',
  'auto_cancelled',
  'expired',
  'timeout',
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

export const VERIFICATION_STATUSES = ['pending', 'verified', 'failed'] as const
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number]

export type OrderStatusDeriveReason =
  | 'NO_DISPATCH'
  | 'REVISION_REQUESTED'
  | 'ALL_SETTLED_AND_DISPATCH_DONE'
  | 'ALL_AWAITING_ACCEPTANCE'
  | 'PUBLISHED_WAITING_FEEDBACK'
  | 'IN_PROGRESS'
  | 'PENDING_ACCEPTANCE'
  | 'NO_MATCH'

const fulfillmentStatusSet = new Set<FulfillmentStatus>(FULFILLMENT_STATUSES)
const dispatchStatusSet = new Set<DispatchStatus>(DISPATCH_STATUSES)
const orderStatusSet = new Set<OrderStatus>(ORDER_STATUSES)
const verificationStatusSet = new Set<VerificationStatus>(VERIFICATION_STATUSES)

export function isFulfillmentStatus(status: any): status is FulfillmentStatus {
  return fulfillmentStatusSet.has(status)
}

export function isDispatchStatus(status: any): status is DispatchStatus {
  return dispatchStatusSet.has(status)
}

export function isOrderStatus(status: any): status is OrderStatus {
  return orderStatusSet.has(status)
}

export function isVerificationStatus(status: any): status is VerificationStatus {
  return verificationStatusSet.has(status)
}

export function normalizeDispatchStatus(status?: string): DispatchStatus {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'pending'
  if (value === 'confirmed') return 'accepted'
  if (value === 'done') return 'done'
  if (value === 'settled') return 'settled'
  if (value === 'completed') return 'completed'
  if (value === 'declined') return 'rejected'
  if (value === 'expired') return 'cancelled'
  if (value === 'rejected') return 'rejected'
  if (value === 'cancelled') return 'cancelled'
  if (value === 'accepted') return 'accepted'
  return 'pending'
}

export function ensureDispatchStatus(status?: string, fallback: DispatchStatus = 'pending'): DispatchStatus {
  const normalized = normalizeDispatchStatus(status)
  return dispatchStatusSet.has(normalized) ? normalized : fallback
}

export function normalizeFulfillmentStatus(status?: string): FulfillmentStatus {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'queuing'
  if (['pending', 'processing', 'generating_text', 'generating_images', 'generating_video'].includes(value)) {
    return 'generating'
  }
  if (['completed'].includes(value)) return 'preview'
  if (value === 'publishing') return 'publishing'
  if (value === 'published') return 'published'
  if (value === 'feedback_submitted') return 'awaiting_acceptance'
  if (value === 'awaiting_acceptance') return 'awaiting_acceptance'
  if (value === 'revision_requested') return 'revision_requested'
  if (['settled', 'done'].includes(value)) return 'settled'
  if (value === 'failed') return 'failed'
  if (value === 'partial_failed') return 'partial_failed'
  if (fulfillmentStatusSet.has(value as FulfillmentStatus)) return value as FulfillmentStatus
  return 'generating'
}

export function ensureFulfillmentStatus(status?: string, fallback: FulfillmentStatus = 'queuing'): FulfillmentStatus {
  const normalized = normalizeFulfillmentStatus(status)
  return fulfillmentStatusSet.has(normalized) ? normalized : fallback
}

export function normalizeVerificationStatus(status?: string): VerificationStatus {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'pending'
  if (['verify', 'verified', 'pass', 'passed', 'success', 'approved'].includes(value)) return 'verified'
  if (['fail', 'failed', 'reject', 'rejected'].includes(value)) return 'failed'
  if (verificationStatusSet.has(value as VerificationStatus)) return value as VerificationStatus
  return 'pending'
}

export function ensureVerificationStatus(
  status?: string,
  fallback: VerificationStatus = 'pending'
): VerificationStatus {
  const normalized = normalizeVerificationStatus(status)
  return verificationStatusSet.has(normalized) ? normalized : fallback
}

export function isDispatchAccepted(status?: string): boolean {
  const value = String(status || '').trim().toLowerCase()
  return [
    'accepted',
    'generating',
    'preview',
    'publishing',
    'published',
    'feedback_submitted',
    'awaiting_acceptance',
    'completed',
    'settled',
    'done',
  ].includes(value)
}

export function isDispatchCompleted(status?: string): boolean {
  const value = String(status || '').trim().toLowerCase()
  return ['completed', 'settled', 'done'].includes(value)
}

export function deriveOrderStatusFromWorkflowDetailed(input: {
  dispatchStatuses: string[]
  fulfillmentStatuses: FulfillmentStatus[]
}): {
  status: OrderStatus | null
  reason: OrderStatusDeriveReason
  signals: Record<string, any>
} {
  const { dispatchStatuses, fulfillmentStatuses } = input
  if (dispatchStatuses.length === 0) {
    return { status: null, reason: 'NO_DISPATCH', signals: { dispatchCount: 0 } }
  }

  const normalizedDispatches = dispatchStatuses.map((s) => normalizeDispatchStatus(s))
  const hasPendingDispatch = normalizedDispatches.includes('pending')
  const hasAcceptedDispatch = normalizedDispatches.some((s) => isDispatchAccepted(s))
  const allDispatchCompleted = normalizedDispatches.every((s) => isDispatchCompleted(s))

  const hasRevisionRequested = fulfillmentStatuses.some((s) => s === 'revision_requested')
  const hasGenerating = fulfillmentStatuses.some((s) => s === 'generating' || s === 'queuing')
  const hasPublishing = fulfillmentStatuses.some((s) => s === 'publishing')
  const allSettled = fulfillmentStatuses.length > 0 && fulfillmentStatuses.every((s) => s === 'settled')
  const allAwaitingAcceptance = fulfillmentStatuses.length > 0
    && fulfillmentStatuses.every((s) => s === 'awaiting_acceptance' || s === 'settled')
  const anyPublishedOrSettled = fulfillmentStatuses.some((s) => s === 'published' || s === 'settled')
  const anyAwaitingAcceptance = fulfillmentStatuses.some((s) => s === 'awaiting_acceptance')

  const signals = {
    dispatchCount: normalizedDispatches.length,
    fulfillmentCount: fulfillmentStatuses.length,
    hasPendingDispatch,
    hasAcceptedDispatch,
    allDispatchCompleted,
    hasRevisionRequested,
    hasGenerating,
    hasPublishing,
    allSettled,
    allAwaitingAcceptance,
    anyPublishedOrSettled,
    anyAwaitingAcceptance,
  }

  if (hasRevisionRequested) return { status: 'revision_requested', reason: 'REVISION_REQUESTED', signals }
  if (allSettled && allDispatchCompleted) return { status: 'completed', reason: 'ALL_SETTLED_AND_DISPATCH_DONE', signals }
  if (allAwaitingAcceptance) return { status: 'awaiting_acceptance', reason: 'ALL_AWAITING_ACCEPTANCE', signals }
  if (anyPublishedOrSettled && !anyAwaitingAcceptance) return { status: 'submitted', reason: 'PUBLISHED_WAITING_FEEDBACK', signals }
  if (hasGenerating || hasPublishing || hasAcceptedDispatch) {
    if (hasAcceptedDispatch && hasPendingDispatch) return { status: 'pending_acceptance', reason: 'PENDING_ACCEPTANCE', signals }
    return { status: 'in_progress', reason: 'IN_PROGRESS', signals }
  }

  return { status: null, reason: 'NO_MATCH', signals }
}

export function deriveOrderStatusFromWorkflow(input: {
  dispatchStatuses: string[]
  fulfillmentStatuses: FulfillmentStatus[]
}): OrderStatus | null {
  return deriveOrderStatusFromWorkflowDetailed(input).status
}
