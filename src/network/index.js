/* eslint-disable no-undef */
// @ts-nocheck
import Taro from '@tarojs/taro'

/**
 * Network Request Module
 * Wraps Taro.request, Taro.uploadFile, Taro.downloadFile with automatic domain prefix
 */

// 异步获取用户ID
const getUserId = async () => {
  try {
    const userInfo = await Taro.getStorage({ key: 'userInfo' })
    console.log('[Network] 获取userInfo:', userInfo?.data)
    return userInfo?.data?.id || ''
  } catch {
    return ''
  }
}

// 异步获取 token
const getToken = async () => {
  try {
    const res = await Taro.getStorage({ key: 'token' })
    return res?.data || ''
  } catch {
    return ''
  }
}

const getAdminToken = async () => {
  try {
    const res = await Taro.getStorage({ key: 'admin_token' })
    return res?.data || ''
  } catch {
    return ''
  }
}

export const request = async (option) => {
  const userId = await getUserId()
  const token = await getToken()
  const adminToken = await getAdminToken()
  console.log('[Network] 当前userId:', userId, 'token:', token ? '已设置' : '未设置')

  const isAdminApi = typeof option?.url === 'string' && option.url.startsWith('/api/admin')
  const finalToken = isAdminApi && adminToken ? adminToken : token

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // PROJECT_DOMAIN is globally injected by Taro config
    // eslint-disable-next-line no-restricted-properties
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    // 小程序必须拼完整URL，H5由Vite proxy转发
    // eslint-disable-next-line no-restricted-properties
    const env = Taro.getEnv()
    if (env === 'WEAPP' || env === 'TT') {
      return `${domain}${url}`
    }
    if (!domain) {
      return url
    }
    return `${domain}${url}`
  }

  const headers = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    ...(userId ? { 'x-user-id': userId } : {}),
    ...(finalToken ? { 'Authorization': `Bearer ${finalToken}` } : {}),
    ...(isAdminApi && adminToken ? { 'admin_token': adminToken } : {}),
    ...(option.header || {}),
  }

  const fullUrl = createUrl(option.url)
  console.log('[Network.request]', option.method || 'GET', fullUrl)

  // 添加时间戳防止GET请求被缓存
  let requestUrl = fullUrl
  if (!option.method || option.method === 'GET') {
    const separator = fullUrl.includes('?') ? '&' : '?'
    requestUrl = fullUrl + separator + '_t=' + Date.now()
  }

  const timeout = option.timeout || 10000

  // eslint-disable-next-line no-restricted-properties
  return Taro.request({
    ...option,
    url: requestUrl,
    header: headers,
    timeout
  })
}

export const uploadFile = async (option) => {
  const userId = await getUserId()
  const token = await getToken()
  const adminToken = await getAdminToken()
  const isAdminApi = typeof option?.url === 'string' && option.url.startsWith('/api/admin')
  const finalToken = isAdminApi && adminToken ? adminToken : token

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // PROJECT_DOMAIN is globally injected by Taro config
    // eslint-disable-next-line no-restricted-properties
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    // eslint-disable-next-line no-restricted-properties
    const env = Taro.getEnv()
    if (env === 'WEAPP' || env === 'TT') {
      return `${domain}${url}`
    }
    if (!domain) {
      return url
    }
    return `${domain}${url}`
  }

  const headers = {
    ...(userId ? { 'x-user-id': userId } : {}),
    ...(finalToken ? { 'Authorization': `Bearer ${finalToken}` } : {}),
    ...(isAdminApi && adminToken ? { 'admin_token': adminToken } : {}),
    ...(option.header || {}),
  }

  console.log('[Network.uploadFile]', option.url, option.filePath)

  const timeout = option.timeout || 100000

  // eslint-disable-next-line no-restricted-properties
  return Taro.uploadFile({
    ...option,
    url: createUrl(option.url),
    header: headers,
    timeout
  })
}

export const downloadFile = async (option) => {
  const userId = await getUserId()
  const token = await getToken()
  const adminToken = await getAdminToken()
  const isAdminApi = typeof option?.url === 'string' && option.url.startsWith('/api/admin')
  const finalToken = isAdminApi && adminToken ? adminToken : token

  const createUrl = (url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    // PROJECT_DOMAIN is globally injected by Taro config
    const domain = typeof PROJECT_DOMAIN !== 'undefined' ? PROJECT_DOMAIN : ''
    return `${domain}${url}`
  }

  const headers = {
    ...(userId ? { 'x-user-id': userId } : {}),
    ...(finalToken ? { 'Authorization': `Bearer ${finalToken}` } : {}),
    ...(isAdminApi && adminToken ? { 'admin_token': adminToken } : {}),
    ...(option.header || {}),
  }

  const timeout = option.timeout || 10000

  // eslint-disable-next-line no-restricted-properties
  return Taro.downloadFile({
    ...option,
    url: createUrl(option.url),
    header: headers,
    timeout
  })
}

// Network 统一导出已移至 src/network.ts，通过 import { Network } from '@/network' 使用
