// Network utilities - wraps Taro.request/uploadFile/downloadFile with automatic domain prefix
import Taro from '@tarojs/taro'

let isHandlingAuthError = false

const getUserId = () => {
  try {
    const userInfo = Taro.getStorageSync('userInfo')
    return userInfo?.id || ''
  } catch {
    return ''
  }
}

const getToken = () => {
  try {
    const token = Taro.getStorageSync('token')
    if (typeof token === 'string') {
      return token
    }
    return ''
  } catch {
    return ''
  }
}

const getAdminToken = () => {
  try {
    const token = Taro.getStorageSync('admin_token')
    if (typeof token === 'string') {
      return token
    }
    return ''
  } catch {
    return ''
  }
}

const normalizeBearerToken = (token: string) => {
  if (!token) {
    return ''
  }
  return /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`
}

const isAdminApi = (url: string) => url.startsWith('/api/admin')

const parseMaybeJson = (data: unknown) => {
  if (data && typeof data === 'object') {
    return data as any
  }
  if (typeof data === 'string') {
    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }
  return null
}

const stableStringify = (value: unknown) => {
  const seen = new WeakSet<object>()

  const stringify = (v: any): string => {
    if (v === null) return 'null'
    const t = typeof v
    if (t === 'undefined') return 'undefined'
    if (t === 'string') return JSON.stringify(v)
    if (t === 'number' || t === 'boolean' || t === 'bigint') return String(v)
    if (t === 'function') return '"[Function]"'
    if (t !== 'object') return JSON.stringify(v)

    if (seen.has(v)) return '"[Circular]"'
    seen.add(v)

    if (Array.isArray(v)) {
      return `[${v.map((item) => stringify(item)).join(',')}]`
    }

    const keys = Object.keys(v).sort()
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stringify(v[k])}`).join(',')}}`
  }

  try {
    return stringify(value)
  } catch {
    try {
      return JSON.stringify(value)
    } catch {
      return '""'
    }
  }
}

const inflightRequests = new Map<string, Promise<any>>()

type NetStats = {
  count: number
  dedupHits: number
  totalMs: number
  maxMs: number
  samples: number[]
  lastSize?: number
}

const netStats = new Map<string, NetStats>()
let netDebugCache: { enabled: boolean; checkedAt: number } = { enabled: false, checkedAt: 0 }
let netDebugPrintEvery = 20
let netDebugGlobalCount = 0

const isNetDebugEnabled = () => {
  const now = Date.now()
  if (now - netDebugCache.checkedAt < 500) return netDebugCache.enabled
  netDebugCache.checkedAt = now
  try {
    netDebugCache.enabled = Taro.getStorageSync('__net_debug__') === '1'
  } catch {
    netDebugCache.enabled = false
  }
  return netDebugCache.enabled
}

const getStat = (key: string) => {
  const existing = netStats.get(key)
  if (existing) return existing
  const created: NetStats = { count: 0, dedupHits: 0, totalMs: 0, maxMs: 0, samples: [] }
  netStats.set(key, created)
  return created
}

const recordDedupHit = (key: string) => {
  const s = getStat(key)
  s.dedupHits += 1
  s.count += 1
}

const recordRequestDone = (key: string, durationMs: number, size?: number) => {
  const s = getStat(key)
  s.count += 1
  s.totalMs += durationMs
  if (durationMs > s.maxMs) s.maxMs = durationMs
  s.samples.push(durationMs)
  if (s.samples.length > 40) s.samples.shift()
  if (typeof size === 'number') s.lastSize = size
}

const maybePrintNetStats = () => {
  // NOTE: 禁止在网络层输出 console 日志（可能造成敏感信息泄露）。
  // 这里仍保留计数与采样逻辑，避免影响其他基于 netDebugGlobalCount 的调试分支。
  if (!isNetDebugEnabled()) return
  netDebugGlobalCount += 1
  if (netDebugGlobalCount % netDebugPrintEvery !== 0) return
  return
}

const buildDedupKey = (option: any) => {
  const key = option?.dedupKey
  if (typeof key === 'string' && key.trim()) return key.trim()
  if (option?.dedup === true) {
    const method = String(option?.method || 'GET').toUpperCase()
    const url = String(option?.url || '')
    const data = stableStringify(option?.data)
    return `${method} ${url} ${data}`
  }
  return ''
}

const buildCurrentPath = () => {
  try {
    const pages: any[] = Taro.getCurrentPages?.() || []
    const current = pages[pages.length - 1]
    const route: string | undefined = current?.route
    const options: Record<string, any> | undefined = current?.options
    if (!route) return ''
    const query = options
      ? Object.keys(options)
          .filter((k) => options[k] !== undefined && options[k] !== null && options[k] !== '')
          .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(String(options[k]))}`)
          .join('&')
      : ''
    return `/${route}${query ? `?${query}` : ''}`
  } catch {
    return ''
  }
}

const clearUserAuthStorage = () => {
  try {
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('userInfo')
  } catch {
    return
  }
}

const clearAdminAuthStorage = () => {
  try {
    Taro.removeStorageSync('admin_token')
    Taro.removeStorageSync('admin_info')
  } catch {
    return
  }
}

const handleAuthError = (originalUrl: string) => {
  if (isHandlingAuthError) return

  const isAdminRequest = isAdminApi(originalUrl)
  const loginPath = isAdminRequest ? '/package-admin/pages/login/index' : '/pages/login/index'
  const currentPath = buildCurrentPath()
  if (currentPath.startsWith(loginPath)) return

  isHandlingAuthError = true
  if (isAdminRequest) {
    clearAdminAuthStorage()
  } else {
    clearUserAuthStorage()
  }

  // const now = Date.now()
  // if (now - lastAuthToastAt > 1500) {
  //   lastAuthToastAt = now
  //   Taro.showToast({ title: '需要重新登录', icon: 'none' })
  // }

  // const redirect = currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''
  // setTimeout(() => {
  //   Taro.navigateTo({ url: `${loginPath}${redirect}` }).finally(() => {
  //     isHandlingAuthError = false
  //   })
  // }, 200)
  setTimeout(() => {
    isHandlingAuthError = false
  }, 1000)
}

const detectAuthErrorFromResponse = (res: any) => {
  const statusCode = res?.statusCode
  if (statusCode === 401 || statusCode === 403) return true
  const payload = parseMaybeJson(res?.data)
  const code = payload?.code
  if (code === 401 || code === 403) return true
  return false
}

const createAuthHeaders = (url: string, customHeader?: Record<string, any>) => {
  const userId = getUserId()
  const userToken = getToken()
  const adminToken = getAdminToken()
  const customAuthorization = customHeader?.Authorization || customHeader?.authorization
  const selectedToken = isAdminApi(url) ? (adminToken || userToken) : userToken

  return {
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(customAuthorization ? {} : (selectedToken ? { Authorization: normalizeBearerToken(selectedToken) } : {})),
    ...(isAdminApi(url) && adminToken ? { 'admin_token': adminToken } : {}),
  }
}

const createUrl = (url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
  return `${domain}${url}`
}

const request = async (option: any) => {
  const dedupKey = buildDedupKey(option)
  if (dedupKey) {
    const existing = inflightRequests.get(dedupKey)
    if (existing) {
      if (isNetDebugEnabled()) {
        recordDedupHit(dedupKey)
        maybePrintNetStats()
      }
      return existing
    }

    const promise = (async () => {
      const startedAt = Date.now()
      const url = createUrl(option.url)
      const header = {
        'Content-Type': 'application/json',
        ...createAuthHeaders(option.url, option.header),
        ...(option.header || {}),
      }
      const res = await Taro.request({ ...option, url, header })
      if (detectAuthErrorFromResponse(res)) {
        handleAuthError(option.url)
      }
      if (isNetDebugEnabled()) {
        let size: number | undefined
        const durationMs = Date.now() - startedAt
        const contentLength = res?.header?.['Content-Length'] || res?.header?.['content-length']
        if (typeof contentLength === 'string' && contentLength) {
          const n = Number(contentLength)
          if (Number.isFinite(n)) size = n
        } else if (durationMs > 600 || (netDebugGlobalCount % 10 === 0)) {
          try {
            size = JSON.stringify(res?.data || '').length
          } catch {
            size = undefined
          }
        }
        recordRequestDone(dedupKey, durationMs, size)
        maybePrintNetStats()
      }
      return res
    })().finally(() => {
      inflightRequests.delete(dedupKey)
    })

    inflightRequests.set(dedupKey, promise)
    return promise
  }

  const statKey = `${String(option?.method || 'GET').toUpperCase()} ${String(option?.url || '')}`
  const startedAt = isNetDebugEnabled() ? Date.now() : 0
  const url = createUrl(option.url)
  const header = {
    'Content-Type': 'application/json',
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  const res = await Taro.request({ ...option, url, header })
  if (detectAuthErrorFromResponse(res)) {
    handleAuthError(option.url)
  }
  if (startedAt) {
    let size: number | undefined
    const durationMs = Date.now() - startedAt
    const contentLength = res?.header?.['Content-Length'] || res?.header?.['content-length']
    if (typeof contentLength === 'string' && contentLength) {
      const n = Number(contentLength)
      if (Number.isFinite(n)) size = n
    } else if (durationMs > 600 || (netDebugGlobalCount % 10 === 0)) {
      try {
        size = JSON.stringify(res?.data || '').length
      } catch {
        size = undefined
      }
    }
    recordRequestDone(statKey, durationMs, size)
    maybePrintNetStats()
  }
  return res
}

const uploadFile = async (option: any) => {
  const statKey = `UPLOAD ${String(option?.url || '')}`
  const startedAt = isNetDebugEnabled() ? Date.now() : 0
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  const res = await Taro.uploadFile({ ...option, url, header })
  if (detectAuthErrorFromResponse(res)) {
    handleAuthError(option.url)
  }
  if (startedAt) {
    recordRequestDone(statKey, Date.now() - startedAt)
    maybePrintNetStats()
  }
  return res
}

const downloadFile = async (option: any) => {
  const statKey = `DOWNLOAD ${String(option?.url || '')}`
  const startedAt = isNetDebugEnabled() ? Date.now() : 0
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  const res = await Taro.downloadFile({ ...option, url, header })
  if (detectAuthErrorFromResponse(res)) {
    handleAuthError(option.url)
  }
  if (startedAt) {
    recordRequestDone(statKey, Date.now() - startedAt)
    maybePrintNetStats()
  }
  return res
}

const getMsg = (payload: unknown, fallback: string) => {
  const parsed = parseMaybeJson(payload)
  const value = parsed?.msg ?? parsed?.message
  if (typeof value === 'string' && value) return value
  if (value != null) return String(value)
  return fallback
}

const Network = { request, uploadFile, downloadFile, getMsg }

export { request, uploadFile, downloadFile, getMsg, Network }
