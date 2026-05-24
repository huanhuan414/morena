export type FulfillmentStatus =
  | 'queuing'
  | 'generating'
  | 'preview'
  | 'publishing'
  | 'published'
  | 'awaiting_acceptance'
  | 'revision_requested'
  | 'settled'
  | 'failed'
  | 'partial_failed'
  | 'rejected'

export type DispatchStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'completed' | 'settled' | 'done'

export type OrderStatus =
  | 'pending_payment'
  | 'open'
  | 'pending_dispatch'
  | 'pending_acceptance'
  | 'in_progress'
  | 'submitted'
  | 'awaiting_acceptance'
  | 'revision_requested'
  | 'completed'
  | 'cancelled'
  | 'rejected'

export type OrderStatusDeriveReason =
  | 'NO_DISPATCH'
  | 'REVISION_REQUESTED'
  | 'ALL_SETTLED_AND_DISPATCH_DONE'
  | 'ALL_AWAITING_ACCEPTANCE'
  | 'PUBLISHED_WAITING_FEEDBACK'
  | 'IN_PROGRESS'
  | 'PENDING_ACCEPTANCE'
  | 'NO_MATCH'

const fulfillmentStatusSet = new Set<FulfillmentStatus>([
  'queuing',
  'generating',
  'preview',
  'publishing',
  'published',
  'awaiting_acceptance',
  'revision_requested',
  'settled',
  'failed',
])

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
  if (value === 'rejected') return 'rejected'
  if (fulfillmentStatusSet.has(value as FulfillmentStatus)) return value as FulfillmentStatus
  return 'generating'
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
  if (anyPublishedOrSettled && !anyAwaitingAcceptance && !hasPendingDispatch) return { status: 'submitted', reason: 'PUBLISHED_WAITING_FEEDBACK', signals }
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
