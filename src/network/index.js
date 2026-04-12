/* eslint-disable no-undef */
// @ts-nocheck
import Taro, { getStorageSync, getEnv, ENV_TYPE } from '@tarojs/taro'

/**
 * Network Request Module
 * Wraps Taro.request, Taro.uploadFile, Taro.downloadFile with automatic domain prefix
 */

export const request = (option) => {
  const userId = (() => {
    try {
      const userInfo = getStorageSync('userInfo')
      return userInfo?.id || ''
    } catch {
      return ''
    }
  })()

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }

    // H5 环境下，如果是本地开发环境，使用相对路径（让 Vite 代理生效）
    if (getEnv() === ENV_TYPE.H5) {
      // 检查是否在本地开发环境
      const isLocalhost = typeof window !== 'undefined' &&
                         (window.location.hostname === 'localhost' ||
                          window.location.hostname === '127.0.0.1' ||
                          window.location.hostname.startsWith('192.168.') ||
                          window.location.hostname.startsWith('10.'))
      if (isLocalhost && url.startsWith('/api/')) {
        console.log('[Network.request] 本地开发环境，使用相对路径:', url)
        return url
      }
    }

    // PROJECT_DOMAIN is globally injected by Taro config
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    return `${domain}${url}`
  }

  const headers = {
    'Content-Type': 'application/json',
    ...(option.header || {}),
    ...(userId ? { 'x-user-id': userId } : {})
  }

  const fullUrl = createUrl(option.url)
  console.log('[Network.request]', option.method || 'GET', fullUrl)

  const timeout = option.timeout || 300000

  // eslint-disable-next-line no-restricted-properties
  return Taro.request({
    ...option,
    url: fullUrl,
    header: headers,
    timeout
  })
}

export const uploadFile = (option) => {
  const userId = (() => {
    try {
      const userInfo = getStorageSync('userInfo')
      return userInfo?.id || ''
    } catch {
      return ''
    }
  })()

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // PROJECT_DOMAIN is globally injected by Taro config
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    return `${domain}${url}`
  }

  const headers = {
    ...(option.header || {}),
    ...(userId ? { 'x-user-id': userId } : {})
  }

  console.log('[Network.uploadFile]', option.url, option.filePath)

  const timeout = option.timeout || 300000

  // eslint-disable-next-line no-restricted-properties
  return Taro.uploadFile({
    ...option,
    url: createUrl(option.url),
    header: headers,
    timeout
  })
}

export const downloadFile = (option) => {
  const userId = (() => {
    try {
      const userInfo = getStorageSync('userInfo')
      return userInfo?.id || ''
    } catch {
      return ''
    }
  })()

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // PROJECT_DOMAIN is globally injected by Taro config
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    return `${domain}${url}`
  }

  const headers = {
    ...(option.header || {}),
    ...(userId ? { 'x-user-id': userId } : {})
  }

  const timeout = option.timeout || 300000

  // eslint-disable-next-line no-restricted-properties
  return Taro.downloadFile({
    ...option,
    url: createUrl(option.url),
    header: headers,
    timeout
  })
}
