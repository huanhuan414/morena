// Network utilities - wraps Taro.request/uploadFile/downloadFile with automatic domain prefix
import Taro from '@tarojs/taro'

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

const request = (option: any) => {
  const url = createUrl(option.url)
  const header = {
    'Content-Type': 'application/json',
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  return Taro.request({ ...option, url, header })
}

const uploadFile = (option: any) => {
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  return Taro.uploadFile({ ...option, url, header })
}

const downloadFile = (option: any) => {
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(option.url, option.header),
    ...(option.header || {}),
  }
  return Taro.downloadFile({ ...option, url, header })
}

const Network = { request, uploadFile, downloadFile }

export { request, uploadFile, downloadFile, Network }
