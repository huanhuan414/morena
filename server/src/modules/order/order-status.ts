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

export type StatusFieldKey =
  | 'orders.status'
  | 'order_dispatch_requests.status'
  | 'content_generation_requests.status'
  | 'earnings.status'
  | 'referrals.status'

type CanonicalStatusDictionary<TStatus extends string> = {
  readonly preserved: readonly TStatus[]
  readonly compatibility: Readonly<Record<string, TStatus>>
  readonly deprecated: readonly string[]
}

type StatusFieldBoundary<TStatus extends string> = {
  readonly owner: string
  readonly field: StatusFieldKey
  readonly interfaceWriter: string
  readonly syncWriter?: string
  readonly forbiddenDirectWrites: readonly string[]
  readonly dictionary: CanonicalStatusDictionary<TStatus>
}

const ORDER_CANONICAL_STATUSES: readonly OrderStatus[] = [
  'pending_payment',
  'open',
  'pending_dispatch',
  'pending_acceptance',
  'in_progress',
  'submitted',
  'awaiting_acceptance',
  'revision_requested',
  'completed',
  'cancelled',
  'rejected',
]

const DISPATCH_CANONICAL_STATUSES = [
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'completed',
] as const

const FULFILLMENT_CANONICAL_STATUSES = [
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

const EARNING_CANONICAL_STATUSES = [
  'pending',
  'settled',
  'rejected',
] as const

const REFERRAL_CANONICAL_STATUSES = [
  'pending',
  'completed',
] as const

const orderStatusSet = new Set<OrderStatus>(ORDER_CANONICAL_STATUSES)
const dispatchStatusSet = new Set<(typeof DISPATCH_CANONICAL_STATUSES)[number]>(DISPATCH_CANONICAL_STATUSES)

const fulfillmentStatusSet = new Set<FulfillmentStatus>([
  'queuing',
  'generating',
  'publishing',
  'published',
  'awaiting_acceptance',
  'revision_requested',
  'settled',
  'failed',
])

export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ['open', 'pending_dispatch', 'cancelled'],
  open: ['pending_dispatch', 'pending_acceptance', 'in_progress', 'submitted', 'awaiting_acceptance', 'completed', 'cancelled'],
  pending_dispatch: ['pending_acceptance', 'in_progress', 'submitted', 'awaiting_acceptance', 'completed', 'cancelled'],
  pending_acceptance: ['in_progress', 'submitted', 'awaiting_acceptance', 'rejected', 'cancelled'],
  in_progress: ['submitted', 'awaiting_acceptance', 'completed', 'cancelled'],
  submitted: ['awaiting_acceptance', 'completed', 'revision_requested', 'cancelled'],
  awaiting_acceptance: ['completed', 'revision_requested', 'cancelled'],
  revision_requested: ['in_progress', 'submitted', 'awaiting_acceptance', 'cancelled'],
  completed: [],
  cancelled: [],
  rejected: [],
}

export const STATUS_FIELD_BOUNDARIES: Readonly<Record<StatusFieldKey, StatusFieldBoundary<string>>> = {
  'orders.status': {
    owner: 'OrderService',
    field: 'orders.status',
    interfaceWriter: 'createOrder/payOrder/updateOrderStatus',
    syncWriter: 'syncOrderStatusByContent',
    forbiddenDirectWrites: [
      'controller/SQL 直接写 pending_acceptance|in_progress|submitted|awaiting_acceptance|completed',
      'order.service.acceptOrder/submitOrderResult 不得绕过 updateOrderStatus 或派单/履约聚合边界直写状态',
    ],
    dictionary: {
      preserved: ORDER_CANONICAL_STATUSES,
      compatibility: {},
      deprecated: [],
    },
  },
  'order_dispatch_requests.status': {
    owner: 'OrderDispatchService / OrderProcessingService',
    field: 'order_dispatch_requests.status',
    interfaceWriter: 'accept/reject/cancel dispatch',
    syncWriter: 'complete on order-processing settlement',
    forbiddenDirectWrites: [
      '订单聚合器不得越过派单服务直接写 accepted|rejected|cancelled|completed',
    ],
    dictionary: {
      preserved: DISPATCH_CANONICAL_STATUSES,
      compatibility: {
        confirmed: 'accepted',
        declined: 'rejected',
        expired: 'cancelled',
        settled: 'completed',
        done: 'completed',
      },
      deprecated: ['confirmed', 'declined', 'expired', 'settled', 'done'],
    },
  },
  'content_generation_requests.status': {
    owner: 'ContentGenerationService / OrderProcessingService',
    field: 'content_generation_requests.status',
    interfaceWriter: 'generation/publish/review workflow',
    syncWriter: 'orders.status 仅可读取本字段，不得反向直写',
    forbiddenDirectWrites: [
      '非生成链路禁止直接写 preview|publishing|published|awaiting_acceptance|settled',
    ],
    dictionary: {
      preserved: FULFILLMENT_CANONICAL_STATUSES,
      compatibility: {
        pending: 'generating',
        processing: 'generating',
        generating_text: 'generating',
        generating_images: 'generating',
        generating_video: 'generating',
        completed: 'preview',
        feedback_submitted: 'awaiting_acceptance',
        done: 'settled',
      },
      deprecated: ['pending', 'processing', 'generating_text', 'generating_images', 'generating_video', 'completed', 'feedback_submitted', 'done'],
    },
  },
  'earnings.status': {
    owner: 'EarningService / ReferralService',
    field: 'earnings.status',
    interfaceWriter: 'create pending earning',
    syncWriter: 'settle earning after到账',
    forbiddenDirectWrites: [
      '页面接口禁止直接把 pending 改为 settled/completed/rejected',
    ],
    dictionary: {
      preserved: EARNING_CANONICAL_STATUSES,
      compatibility: {
        completed: 'settled',
      },
      deprecated: ['completed'],
    },
  },
  'referrals.status': {
    owner: 'ReferralService',
    field: 'referrals.status',
    interfaceWriter: 'useReferralCode/create pending referral',
    syncWriter: 'settleReferralOnFirstAvatar',
    forbiddenDirectWrites: [
      '收益模块禁止跳过 ReferralService 直接改 referrals.status',
    ],
    dictionary: {
      preserved: REFERRAL_CANONICAL_STATUSES,
      compatibility: {},
      deprecated: [],
    },
  },
}

export function normalizeOrderStatus(status?: string): OrderStatus | null {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return null
  if (orderStatusSet.has(value as OrderStatus)) return value as OrderStatus
  return null
}

export function normalizeDispatchStatus(status?: string): DispatchStatus {
  const value = String(status || '').trim().toLowerCase()
  if (!value) return 'pending'
  const compatibilityStatus = STATUS_FIELD_BOUNDARIES['order_dispatch_requests.status'].dictionary.compatibility[value]
  if (compatibilityStatus) return compatibilityStatus as DispatchStatus
  if (dispatchStatusSet.has(value as (typeof DISPATCH_CANONICAL_STATUSES)[number])) {
    return value as DispatchStatus
  }
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
  if (fulfillmentStatusSet.has(value as FulfillmentStatus)) return value as FulfillmentStatus
  return 'generating'
}

export function isDispatchAccepted(status?: string): boolean {
  return ['accepted', 'completed'].includes(normalizeDispatchStatus(status))
}

export function isDispatchCompleted(status?: string): boolean {
  return normalizeDispatchStatus(status) === 'completed'
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

export function isValidOrderStatusTransition(fromStatus: string, toStatus: string): boolean {
  const from = normalizeOrderStatus(fromStatus)
  const to = normalizeOrderStatus(toStatus)
  if (!from || !to) return false
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[from] || []
  return allowedTransitions.includes(to)
}
