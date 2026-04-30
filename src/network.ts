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

const createUrl = (url: string) => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
  return `${domain}${url}`
}

const request = (option: any) => {
  const userId = getUserId()
  const url = createUrl(option.url)
  const header = {
    'Content-Type': 'application/json',
    ...(userId ? { 'X-User-Id': userId } : {}),
    ...(option.header || {}),
  }
  return Taro.request({ ...option, url, header })
}

const uploadFile = (option: any) => {
  const url = createUrl(option.url)
  return Taro.uploadFile({ ...option, url })
}

const downloadFile = (option: any) => {
  const url = createUrl(option.url)
  return Taro.downloadFile({ ...option, url })
}

const Network = { request, uploadFile, downloadFile }

export { request, uploadFile, downloadFile, Network }
