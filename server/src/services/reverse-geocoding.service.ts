import { Injectable } from '@nestjs/common'

export interface ReverseGeocodingResult {
  formatted_address: string
  country?: string
  province?: string
  city?: string
  district?: string
  street?: string
  full_location_text: string
}

@Injectable()
export class ReverseGeocodingService {
  /**
   * 逆地理编码：将经纬度转换为具体地理位置
   * 使用 OpenStreetMap 的 Nominatim API（免费，无需 API Key）
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
    try {
      // 调用 Nominatim API 进行逆地理编码
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN`
      )

      if (!response.ok) {
        throw new Error(`逆地理编码请求失败: ${response.statusText}`)
      }

      const data = await response.json()

      // 解析返回的地址信息
      const address = data.address || {}
      const display_name = data.display_name || ''

      // 提取各个级别的地理位置信息
      const country = address.country || ''
      const province = address.state || address.province || ''
      const city = address.city || address.town || address.district || ''
      const district = address.suburb || address.district || ''
      const street = address.road || address.street || ''

      // 构建完整的位置文本
      const full_location_text = display_name || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`

      // 构建简化的格式化地址（优先显示中文信息）
      const formatted_address_parts: string[] = []
      if (country) formatted_address_parts.push(country)
      if (province) formatted_address_parts.push(province)
      if (city) formatted_address_parts.push(city)
      if (district) formatted_address_parts.push(district)
      if (street) formatted_address_parts.push(street)

      const formatted_address = formatted_address_parts.join(' ') || full_location_text

      return {
        formatted_address,
        country,
        province,
        city,
        district,
        street,
        full_location_text
      }
    } catch (error) {
      console.error('[逆地理编码] 失败:', error)
      // 失败时返回基本信息
      return {
        formatted_address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        full_location_text: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      }
    }
  }

  /**
   * 批量逆地理编码
   */
  async batchReverseGeocode(locations: Array<{ latitude: number; longitude: number }>): Promise<ReverseGeocodingResult[]> {
    const results = await Promise.all(
      locations.map(loc => this.reverseGeocode(loc.latitude, loc.longitude))
    )
    return results
  }
}
