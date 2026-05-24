// 共享内存缓存，所有需要缓存的服务都可以使用
// 使用 global 对象确保在 NestJS 中也是单例
declare global {
  var __sharedCache: Map<string, any>
  var __sharedCacheInitialized: boolean
}

if (!global.__sharedCache) {
  global.__sharedCache = new Map<string, any>()
  global.__sharedCacheInitialized = true
}

const sharedCache = global.__sharedCache

export function getSharedCache(): Map<string, any> {
  return sharedCache
}

export function setCache(key: string, data: any): void {
  sharedCache.set(key, data)
  // 1小时后自动清理
  setTimeout(() => {
    sharedCache.delete(key)
  }, 3600000)
}

export function getCache(key: string): any {
  const result = sharedCache.get(key)
  return result
}

export function deleteCache(key: string): void {
  sharedCache.delete(key)
}

export function clearCache(): void {
  sharedCache.clear()
}
