/* eslint-disable no-undef */
// @ts-nocheck
import Taro, { getStorageSync } from '@tarojs/taro'

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

    // 优先使用用户配置的域名，Coze 平台域名作为备用
    // @ts-ignore
    const cozeDomain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    // 用户自定义域名（用于直连服务器运营）
    const USER_DOMAIN = 'https://mrlweb.51webjs.com'
    const domain = USER_DOMAIN || cozeDomain || ''
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
    // 优先使用用户配置的域名，Coze 平台域名作为备用
    // @ts-ignore
    const cozeDomain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    // 用户自定义域名（用于直连服务器运营）
    const USER_DOMAIN = 'https://mrlweb.51webjs.com'
    const domain = USER_DOMAIN || cozeDomain || ''
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

// Network 统一导出已移至 src/network.ts，通过 import { Network } from '@/network' 使用
