import { deriveOrderStatusFromWorkflowDetailed, normalizeFulfillmentStatus } from './order-status'

describe('order-status', () => {
  it('normalizeFulfillmentStatus should normalize generating variants', () => {
    expect(normalizeFulfillmentStatus(undefined)).toBe('queuing')
    expect(normalizeFulfillmentStatus('processing')).toBe('generating')
    expect(normalizeFulfillmentStatus('generating_text')).toBe('generating')
    expect(normalizeFulfillmentStatus('completed')).toBe('preview')
    expect(normalizeFulfillmentStatus('settled')).toBe('settled')
  })

  it('normalizeFulfillmentStatus should normalize other variants', () => {
    expect(normalizeFulfillmentStatus('publishing')).toBe('publishing')
    expect(normalizeFulfillmentStatus('published')).toBe('published')
    expect(normalizeFulfillmentStatus('revision_requested')).toBe('revision_requested')
    expect(normalizeFulfillmentStatus('failed')).toBe('failed')
    expect(normalizeFulfillmentStatus('unknown_value')).toBe('generating')
  })

  it('deriveOrderStatusFromWorkflowDetailed should derive completed when all settled and dispatch done', () => {
    const result = deriveOrderStatusFromWorkflowDetailed({
      dispatchStatuses: ['completed', 'completed'],
      fulfillmentStatuses: ['settled', 'settled']
    })
    expect(result.status).toBe('completed')
    expect(result.reason).toBe('ALL_SETTLED_AND_DISPATCH_DONE')
  })

  it('deriveOrderStatusFromWorkflowDetailed should derive awaiting_acceptance when all awaiting_acceptance or settled', () => {
    const result = deriveOrderStatusFromWorkflowDetailed({
      dispatchStatuses: ['accepted'],
      fulfillmentStatuses: ['awaiting_acceptance', 'settled']
    })
    expect(result.status).toBe('awaiting_acceptance')
    expect(result.reason).toBe('ALL_AWAITING_ACCEPTANCE')
  })

  it('deriveOrderStatusFromWorkflowDetailed should derive revision_requested when any revision_requested exists', () => {
    const result = deriveOrderStatusFromWorkflowDetailed({
      dispatchStatuses: ['accepted'],
      fulfillmentStatuses: ['revision_requested']
    })
    expect(result.status).toBe('revision_requested')
    expect(result.reason).toBe('REVISION_REQUESTED')
  })
})
