// 共享内存缓存，所有需要缓存的服务都可以使用
// 使用 global 对象确保在 NestJS 中也是单例
declare global {
  var __sharedCache: Map<string, any>
  var __sharedCacheInitialized: boolean
}

if (!global.__sharedCache) {
  global.__sharedCache = new Map<string, any>()
  global.__sharedCacheInitialized = true
  console.log('[SharedCache] 全局缓存初始化')
}

const sharedCache = global.__sharedCache

export function getSharedCache(): Map<string, any> {
  console.log('[SharedCache] getSharedCache 被调用, 当前缓存大小:', sharedCache.size)
  return sharedCache
}

export function setCache(key: string, data: any): void {
  console.log('[SharedCache] setCache 被调用, key:', key)
  sharedCache.set(key, data)
  console.log('[SharedCache] 缓存设置后大小:', sharedCache.size)
  // 1小时后自动清理
  setTimeout(() => {
    sharedCache.delete(key)
  }, 3600000)
}

export function getCache(key: string): any {
  const result = sharedCache.get(key)
  console.log('[SharedCache] getCache, key:', key, '结果:', result ? '存在' : '不存在')
  return result
}

export function deleteCache(key: string): void {
  sharedCache.delete(key)
}

export function clearCache(): void {
  sharedCache.clear()
}
