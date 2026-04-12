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

    // 在 Coze 平台环境中，使用相对路径，让 Coze 网关处理 /api 路由
    // PROJECT_DOMAIN 在开发模式下为空字符串
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    return `${domain}${url}`
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
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
