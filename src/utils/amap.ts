/**
 * 高德地图API配置
 *
 * 使用说明：
 * 1. 后端服务调用：使用 AMAP_WEB_SERVICE_KEY
 * 2. 小程序直接调用：使用 AMAP_MINIPROGRAM_KEY
 */

export const AMAP_CONFIG = {
  // Web服务Key（后端服务器调用使用）
  WEB_SERVICE_KEY: '5f5b139f9cce3da88b6813304541b47d',

  // 微信小程序Key（前端小程序直接调用使用）
  MINIPROGRAM_KEY: 'a2fd21655a31c73e42294c459123adf5',

  // 高德地图API基础URL
  BASE_URL: 'https://restapi.amap.com'
}

/**
 * 前端直接调用高德逆地理编码API
 * 注意：此方法仅用于微信小程序端，需要在 app.json 中配置允许的域名
 *
 * @param latitude 纬度
 * @param longitude 经度
 * @returns 详细地址信息
 */
export async function reverseGeocodeFromMiniProgram(latitude: number, longitude: number) {
  try {
    const url = `${AMAP_CONFIG.BASE_URL}/v3/geocode/regeo?key=${AMAP_CONFIG.MINIPROGRAM_KEY}&location=${longitude},${latitude}&extensions=all&output=json`

    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`逆地理编码请求失败: ${response.statusText}`)
    }

    const data = await response.json()

    if (data.status !== '1') {
      throw new Error(`逆地理编码API返回错误: ${data.info}`)
    }

    const regeocode = data.regeocode
    const addressComponent = regeocode.addressComponent || {}

    return {
      formattedAddress: regeocode.formatted_address || '',
      country: addressComponent.country || '',
      province: addressComponent.province || '',
      city: addressComponent.city || '',
      district: addressComponent.district || '',
      street: addressComponent.township || '',
      streetNumber: addressComponent.streetNumber?.street || '',
      adcode: addressComponent.adcode || '',
      pois: regeocode.pois?.map((poi: any) => ({
        name: poi.name,
        address: poi.address,
        distance: poi.distance
      })) || []
    }
  } catch (error) {
    console.error('[前端逆地理编码] 失败:', error)
    throw error
  }
}

/**
 * 判断当前是否为微信小程序环境
 */
export function isWeChatMiniProgram(): boolean {
  return typeof (global as any).wx !== 'undefined'
}
