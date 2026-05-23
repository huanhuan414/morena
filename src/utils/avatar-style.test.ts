import { describe, expect, it } from 'vitest'
import { AVATAR_STYLES, getAvatarStyleClass } from './avatar-style'

describe('avatar-style', () => {
  it('getAvatarStyleClass should default to real', () => {
    expect(getAvatarStyleClass()).toBe('avatar-style-real')
  })

  it('getAvatarStyleClass should use provided style', () => {
    expect(getAvatarStyleClass('anime')).toBe('avatar-style-anime')
  })

  it('AVATAR_STYLES should include 8 predefined styles', () => {
    expect(AVATAR_STYLES.length).toBe(8)
    expect(AVATAR_STYLES[0]).toEqual({ value: 'real', label: '真实' })
  })
})

