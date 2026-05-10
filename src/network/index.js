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
      console.log('[Network] 获取userInfo:', userInfo)
      return userInfo?.id || ''
    } catch {
      return ''
    }
  })()
  
  console.log('[Network] 当前userId:', userId)

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    
    // 在小程序环境中使用相对路径（由 Vite proxy 转发）
    // eslint-disable-next-line no-restricted-properties
    const env = Taro.getEnv()
    if (env === 'WEAPP' || env === 'RN' || !USER_DOMAIN) {
      return url
    }
    return `${USER_DOMAIN}${url}`
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
    // 在小程序环境中使用相对路径（由 Vite proxy 转发）
    // eslint-disable-next-line no-restricted-properties
    const env = Taro.getEnv()
    if (env === 'WEAPP' || env === 'RN' || !USER_DOMAIN) {
      return url
    }
    return `${USER_DOMAIN}${url}`
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
