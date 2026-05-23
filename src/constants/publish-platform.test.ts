import { describe, expect, it } from 'vitest'
import { canonicalizePlatform, canonicalizePlatforms, getPlatformLabel } from './publish-platform'

describe('publish-platform', () => {
  it('canonicalizePlatform should normalize aliases', () => {
    expect(canonicalizePlatform('wechat')).toBe('wechat_mp')
    expect(canonicalizePlatform('xhs')).toBe('xiaohongshu')
    expect(canonicalizePlatform('douyin')).toBe('douyin')
  })

  it('canonicalizePlatforms should dedupe', () => {
    const result = canonicalizePlatforms(['wechat', 'wechat_mp', 'xhs', 'xiaohongshu'])
    expect(result).toEqual(['wechat_mp', 'xiaohongshu'])
  })

  it('getPlatformLabel should return fallback label', () => {
    expect(getPlatformLabel('unknown_platform')).toBe('unknown_platform')
  })
})
