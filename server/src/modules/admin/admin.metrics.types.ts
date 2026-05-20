export type MetricsRangeInput = {
  days?: number
  startDate?: string
  endDate?: string
}

export type MetricsRangeResolved = {
  mode: 'days' | 'custom'
  days: number
  startAt: string
  endAt: string
}

export type AdminKpi = {
  totalOrders: number
  paidOrders: number | null
  totalGmv: number
  newUsers: number
  activeAvatars: number
}

export type AdminNorthStar = {
  verifiedGmv: number
  verifiedOrderCount: number
}

export type AdminMetricsOverview = {
  range: MetricsRangeResolved
  northStar: AdminNorthStar
  kpi: AdminKpi
}

export type FunnelStep = {
  key: string
  label: string
  count: number | null
  conversionFromPrev: number | null
}

export type AdminMetricsFunnel = {
  range: MetricsRangeResolved
  demand: FunnelStep[]
  supply: FunnelStep[]
  flags: {
    ordersPaidSupported: boolean
    dispatchSettledSupported: boolean
  }
}

export type FailureReasonItem = {
  reason: string
  count: number
}

export type FailureReasonGroupKey = 'dispatch' | 'fulfillment' | 'verification' | 'settlement'

export type FailureReasonGroup = {
  key: FailureReasonGroupKey
  label: string
  items: FailureReasonItem[]
}

export type AdminFailureReasons = {
  range: MetricsRangeResolved
  top: number
  groups: FailureReasonGroup[]
}
