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
        return `${PROJECT_DOMAIN}${url}`
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

        console.log('[Network.request]', option.method || 'GET', option.url, option.data || '')

        return Taro.request({
            ...option,
            url: createUrl(option.url),
            header: headers,
        })
    }

    export const uploadFile: typeof Taro.uploadFile = option => {
        const userId = getUserId()
        const headers = {
            ...(option.header || {}),
            ...(userId ? { 'x-user-id': userId } : {})
        }

        console.log('[Network.uploadFile]', option.url, option.filePath)

        return Taro.uploadFile({
            ...option,
            url: createUrl(option.url),
            header: headers,
        })
    }

    export const downloadFile: typeof Taro.downloadFile = option => {
        const userId = getUserId()
        const headers = {
            ...(option.header || {}),
            ...(userId ? { 'x-user-id': userId } : {})
        }

        return Taro.downloadFile({
            ...option,
            url: createUrl(option.url),
            header: headers,
        })
    }
}
