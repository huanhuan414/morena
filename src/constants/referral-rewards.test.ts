import { describe, expect, it } from 'vitest'
import {
  BANNER_DESC,
  INVITEE_BASE_REWARD,
  INVITER_BASE_REWARD,
  REFERRAL_MILESTONES,
  REWARD_CENTS_TO_YUAN,
  REWARD_YUAN_TO_CENTS,
} from './referral-rewards'

describe('referral-rewards', () => {
  it('base rewards should be positive', () => {
    expect(INVITER_BASE_REWARD).toBeGreaterThan(0)
    expect(INVITEE_BASE_REWARD).toBeGreaterThan(0)
  })

  it('BANNER_DESC should include invited count', () => {
    expect(BANNER_DESC(3)).toContain('已邀请 3 人')
  })

  it('REFERRAL_MILESTONES should be increasing', () => {
    const counts = REFERRAL_MILESTONES.map(m => m.count)
    expect(counts).toEqual([...counts].sort((a, b) => a - b))
  })

  it('reward conversion should be reversible for cents precision', () => {
    const cents = REWARD_YUAN_TO_CENTS(12.34)
    expect(cents).toBe(1234)
    expect(REWARD_CENTS_TO_YUAN(cents)).toBe(12.34)
  })
})

