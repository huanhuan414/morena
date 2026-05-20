// Network utilities - wraps Taro.request/uploadFile/downloadFile with automatic domain prefix
import Taro from '@tarojs/taro'

let isHandlingAuthError = false
let lastAuthToastAt = 0

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

const clearAuthStorage = () => {
  try {
    Taro.removeStorageSync('token')
    Taro.removeStorageSync('userInfo')
    Taro.removeStorageSync('admin_token')
    Taro.removeStorageSync('admin_info')
  } catch {
    return
  }
}

const handleAuthError = (originalUrl: string) => {
  if (isHandlingAuthError) return

  const loginPath = isAdminApi(originalUrl) ? '/package-admin/pages/login/index' : '/pages/login/index'
  const currentPath = buildCurrentPath()
  if (currentPath.startsWith(loginPath)) return

  isHandlingAuthError = true
  clearAuthStorage()

  const now = Date.now()
  if (now - lastAuthToastAt > 1500) {
    lastAuthToastAt = now
    Taro.showToast({ title: '需要重新登录', icon: 'none' })
  }

  const redirect = currentPath ? `?redirect=${encodeURIComponent(currentPath)}` : ''
  setTimeout(() => {
    Taro.navigateTo({ url: `${loginPath}${redirect}` }).finally(() => {
      isHandlingAuthError = false
    })
  }, 200)
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
  const selectedToken = isAdminApi(url) ? (adminToken || userToken) : (userToken || adminToken)

  return {
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(customAuthorization ? {} : (selectedToken ? { Authorization: normalizeBearerToken(selectedToken) } : {})),
    ...(adminToken ? { 'admin_token': adminToken } : {}),
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
  return res
}

const uploadFile = async (option: any) => {
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  const res = await Taro.uploadFile({ ...option, url, header })
  if (detectAuthErrorFromResponse(res)) {
    handleAuthError(option.url)
  }
  return res
}

const downloadFile = async (option: any) => {
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  const res = await Taro.downloadFile({ ...option, url, header })
  if (detectAuthErrorFromResponse(res)) {
    handleAuthError(option.url)
  }
  return res
}

const Network = { request, uploadFile, downloadFile }

export { request, uploadFile, downloadFile, Network }
