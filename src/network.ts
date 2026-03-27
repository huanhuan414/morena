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
        return `${PROJECT_DOMAIN}${url}`
    }

    const getUserId = (): string => {
        try {
            const userInfo = getStorageSync('userInfo')
            return userInfo?.id || ''
        } catch {
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
