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
   * 中国主要城市坐标范围数据（用于简化的地理位置判断）
   */
  private readonly CITY_REGIONS = [
    { name: '北京市', latRange: [39.4, 41.0], lonRange: [115.7, 117.4], province: '北京市' },
    { name: '上海市', latRange: [30.7, 31.9], lonRange: [120.9, 122.2], province: '上海市' },
    { name: '广州市', latRange: [22.5, 24.0], lonRange: [112.9, 114.5], province: '广东省' },
    { name: '深圳市', latRange: [22.4, 22.9], lonRange: [113.8, 114.6], province: '广东省' },
    { name: '成都市', latRange: [30.0, 31.0], lonRange: [103.5, 104.9], province: '四川省' },
    { name: '杭州市', latRange: [29.8, 30.6], lonRange: [119.8, 120.9], province: '浙江省' },
    { name: '武汉市', latRange: [29.9, 30.9], lonRange: [113.6, 115.1], province: '湖北省' },
    { name: '西安市', latRange: [33.8, 34.5], lonRange: [107.8, 109.5], province: '陕西省' },
    { name: '重庆市', latRange: [28.5, 30.4], lonRange: [105.3, 107.5], province: '重庆市' },
    { name: '南京市', latRange: [31.6, 32.6], lonRange: [118.3, 119.5], province: '江苏省' },
    { name: '天津市', latRange: [38.5, 40.2], lonRange: [116.7, 118.0], province: '天津市' },
    { name: '苏州市', latRange: [30.7, 31.9], lonRange: [119.8, 121.0], province: '江苏省' },
    { name: '长沙市', latRange: [27.7, 28.9], lonRange: [112.3, 113.9], province: '湖南省' },
    { name: '郑州市', latRange: [34.3, 35.3], lonRange: [112.8, 114.5], province: '河南省' },
    { name: '贵阳市', latRange: [26.0, 27.0], lonRange: [106.3, 107.3], province: '贵州省' },
    { name: '昆明市', latRange: [24.5, 26.5], lonRange: [102.3, 103.5], province: '云南省' },
    { name: '沈阳市', latRange: [41.3, 42.2], lonRange: [122.7, 124.0], province: '辽宁省' },
    { name: '青岛市', latRange: [35.5, 36.5], lonRange: [119.8, 121.0], province: '山东省' },
    { name: '大连市', latRange: [38.7, 39.5], lonRange: [121.0, 122.5], province: '辽宁省' },
    { name: '厦门市', latRange: [24.3, 24.9], lonRange: [117.8, 118.5], province: '福建省' },
    // 可以继续添加更多城市...
  ]

  /**
   * 根据经纬度判断大致位置（中国境内）
   */
  private getLocationByCoordinates(latitude: number, longitude: number): { province: string, city: string } | null {
    for (const region of this.CITY_REGIONS) {
      if (
        latitude >= region.latRange[0] && latitude <= region.latRange[1] &&
        longitude >= region.lonRange[0] && longitude <= region.lonRange[1]
      ) {
        return {
          province: region.province,
          city: region.name
        }
      }
    }
    return null
  }

  /**
   * 逆地理编码：将经纬度转换为具体地理位置
   * 优先使用 OpenStreetMap 的 Nominatim API，失败时降级为本地坐标范围判断
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
    // 尝试使用 Nominatim API
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=zh-CN`,
        {
          signal: AbortSignal.timeout(5000) // 5秒超时
        }
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
      console.warn('[逆地理编码] Nominatim API 失败，使用本地坐标范围判断:', error)

      // 降级：使用本地坐标范围判断
      const location = this.getLocationByCoordinates(latitude, longitude)

      if (location) {
        // 成功匹配到城市
        const formatted_address = `中国 ${location.province} ${location.city}`
        return {
          formatted_address,
          country: '中国',
          province: location.province,
          city: location.city,
          district: '',
          street: '',
          full_location_text: formatted_address
        }
      } else {
        // 未匹配到城市，返回经纬度
        return {
          formatted_address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          full_location_text: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
        }
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
