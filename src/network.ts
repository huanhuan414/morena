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

const createAuthHeaders = () => {
  const userId = getUserId()
  const token = getToken()

  return {
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    ...createAuthHeaders(),
    ...(option.header || {}),
  }
  return Taro.request({ ...option, url, header })
}

const uploadFile = (option: any) => {
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(),
    ...(option.header || {}),
  }
  return Taro.uploadFile({ ...option, url, header })
}

const downloadFile = (option: any) => {
  const url = createUrl(option.url)
  const header = {
    ...createAuthHeaders(),
    ...(option.header || {}),
  }
  return Taro.downloadFile({ ...option, url, header })
}

const Network = { request, uploadFile, downloadFile }

export { request, uploadFile, downloadFile, Network }
