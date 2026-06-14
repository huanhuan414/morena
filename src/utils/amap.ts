/**
 * 高德地图API配置
 *
 * 使用说明：
 * 1. 后端服务调用：使用 AMAP_WEB_SERVICE_KEY
 * 2. 小程序直接调用：通过后端API
 */

import Taro from '@tarojs/taro'
import { Network } from '@/network'

export const AMAP_CONFIG = {
  // Web服务Key（后端服务器调用使用）
  WEB_SERVICE_KEY: '5f5b139f9cce3da88b6813304541b47d',

  // 微信小程序Key（前端小程序直接调用使用）
  MINIPROGRAM_KEY: 'a2fd21655a31c73e42294c459123adf5',

  // 高德地图API基础URL
  BASE_URL: 'https://restapi.amap.com'
}

/**
 * 通过后端API进行逆地理编码
 * 微信小程序无法直接调用高德API，需要通过后端代理
 *
 * @param latitude 纬度
 * @param longitude 经度
 * @returns 详细地址信息
 */
export async function reverseGeocodeFromMiniProgram(latitude: number, longitude: number) {
  try {
    // 调用后端API进行逆地理编码
    const response = await Network.request({
      url: `/api/avatar/geocode/reverse?lat=${latitude}&lon=${longitude}`,
      method: 'GET',
    })

    const data = response.data
    if (data.code !== 200) {
      throw new Error(data.msg || '逆地理编码失败')
    }

    const addressInfo = data.data
    return {
      formattedAddress: addressInfo.formatted_address || addressInfo.full_location_text || '',
      country: addressInfo.country || '',
      province: addressInfo.province || '',
      city: addressInfo.city || '',
      district: addressInfo.district || '',
      street: addressInfo.street || '',
      streetNumber: addressInfo.streetNumber || '',
      adcode: addressInfo.adcode || '',
      pois: addressInfo.pois || []
    }
  } catch (error) {
    console.error('[逆地理编码] 通过后端API失败:', error)
    throw error
  }
}

/**
 * 判断当前是否为微信小程序环境
 */
export function isWeChatMiniProgram(): boolean {
  return typeof (global as any).wx !== 'undefined'
}