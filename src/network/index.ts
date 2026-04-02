import Taro, { getStorageSync } from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 * 自动添加用户ID header (x-user-id)
 */

interface NetworkOption {
  url: string
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  data?: any
  header?: Record<string, string>
  timeout?: number
  filePath?: string
  name?: string
  formData?: any
}

interface NetworkResponse {
  statusCode: number
  data: any
  header?: Record<string, string>
  errMsg?: string
}

const createUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  
  // 小程序环境使用完整域名
  const domain = PROJECT_DOMAIN || ''
  if (!domain) {
    console.error('[Network] PROJECT_DOMAIN 未定义！')
  }
  const fullUrl = `${domain}${url}`
  console.log('[Network] 请求URL:', fullUrl)
  return fullUrl
}

const getUserId = (): string => {
  try {
    const userInfo = getStorageSync('userInfo')
    console.log('[Network] 获取用户ID:', userInfo?.id || '无用户ID', '用户信息:', userInfo)
    return userInfo?.id || ''
  } catch {
    console.log('[Network] 获取用户ID失败')
    return ''
  }
}

export const request = (option: NetworkOption): Promise<NetworkResponse> => {
  const userId = getUserId()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(option.header || {}),
    ...(userId ? { 'x-user-id': userId } : {})
  }

  const fullUrl = createUrl(option.url)
  console.log('[Network.request]', option.method || 'GET', fullUrl, option.data || '')

  // 设置超时时间（默认5分钟）
  const timeout = option.timeout || 300000

  // 使用 Taro.request 但通过类型断言绕过 ESLint 检查
  // eslint-disable-next-line no-restricted-properties
  return Taro.request({
    ...option,
    url: fullUrl,
    header: headers,
    timeout
  }) as Promise<NetworkResponse>
}

export const uploadFile = (option: NetworkOption & { filePath: string; name: string }): Promise<NetworkResponse> => {
  const userId = getUserId()
  const headers: Record<string, string> = {
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
  }) as Promise<NetworkResponse>
}

export const downloadFile = (option: NetworkOption): Promise<NetworkResponse> => {
  const userId = getUserId()
  const headers: Record<string, string> = {
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
  }) as unknown as Promise<NetworkResponse>
}
