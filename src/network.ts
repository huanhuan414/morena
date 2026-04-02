import Taro, { getStorageSync } from '@tarojs/taro'

/**
 * 网络请求模块
 * 封装 Taro.request、Taro.uploadFile、Taro.downloadFile，自动添加项目域名前缀
 * 如果请求的 url 以 http:// 或 https:// 开头，则不会添加域名前缀
 *
 * IMPORTANT: 项目已经全局注入 PROJECT_DOMAIN
 * 自动添加用户ID header (x-user-id)
 */
export namespace Network {
    const createUrl = (url: string): string => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            return url
        }
        
        // H5 开发环境使用相对路径，让 Vite proxy 处理
        // 注意：Taro.getEnv() 在 H5 开发环境返回 'h5'
        if (process.env.TARO_ENV === 'h5') {
            return url  // 返回相对路径，Vite proxy 会自动代理
        }
        
        // 小程序环境使用完整域名
        const domain = PROJECT_DOMAIN || ''
        if (!domain) {
            console.error('[Network] PROJECT_DOMAIN 未定义！')
        }
        const fullUrl = `${domain}${url}`
        console.log('[Network] 小程序请求URL:', fullUrl)
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

    export const request: typeof Taro.request = option => {
        const userId = getUserId()
        const headers = {
            'Content-Type': 'application/json',
            ...(option.header || {}),
            ...(userId ? { 'x-user-id': userId } : {})
        }

        const fullUrl = createUrl(option.url)
        console.log('[Network.request]', option.method || 'GET', fullUrl, option.data || '')

        // 小程序端设置更长的超时时间（5分钟）
        const timeout = process.env.TARO_ENV === 'h5' 
            ? (option.timeout || 60000)  // H5 默认 60 秒
            : (option.timeout || 300000)  // 小程序默认 5 分钟

        return Taro.request({
            ...option,
            url: fullUrl,
            header: headers,
            timeout
        })
    }

    export const uploadFile: typeof Taro.uploadFile = option => {
        const userId = getUserId()
        const headers = {
            ...(option.header || {}),
            ...(userId ? { 'x-user-id': userId } : {})
        }

        console.log('[Network.uploadFile]', option.url, option.filePath)

        // 小程序端设置更长的超时时间（5分钟）
        const timeout = process.env.TARO_ENV === 'h5' 
            ? (option.timeout || 60000)
            : (option.timeout || 300000)

        return Taro.uploadFile({
            ...option,
            url: createUrl(option.url),
            header: headers,
            timeout
        })
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        const userId = getUserId()
        const headers = {
            ...(option.header || {}),
            ...(userId ? { 'x-user-id': userId } : {})
        }

        // 小程序端设置更长的超时时间（5分钟）
        const timeout = process.env.TARO_ENV === 'h5' 
            ? (option.timeout || 60000)
            : (option.timeout || 300000)

        return Taro.downloadFile({
            ...option,
            url: createUrl(option.url),
            header: headers,
            timeout
        })
    }
}
