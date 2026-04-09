import { Injectable } from '@nestjs/common'

export interface ReverseGeocodingResult {
  formatted_address: string
  country?: string
  province?: string
  city?: string
  district?: string
  street?: string
  full_location_text: string
  adcode?: string
  pois?: Array<{
    name: string
    address: string
    distance: string
  }>
}

@Injectable()
export class ReverseGeocodingService {
  // 高德地图API Key
  private readonly AMAP_API_KEY = 'a2fd21655a31c73e42294c459123adf5'
  private readonly AMAP_BASE_URL = 'https://restapi.amap.com'

  /**
   * 坐标转换：将WGS84转换为GCJ02（火星坐标系）
   * 高德地图使用GCJ02坐标系，需要先将WGS84转换
   */
  private async convertWGS84ToGCJ02(latitude: number, longitude: number): Promise<{ lat: number; lon: number }> {
    try {
      const response = await fetch(
        `${this.AMAP_BASE_URL}/v3/assistant/coordinate/convert?key=${this.AMAP_API_KEY}&locations=${longitude},${latitude}&coordsys=gps&output=json`
      )

      if (!response.ok) {
        throw new Error(`坐标转换请求失败: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status === '1' && data.locations) {
        const [lon, lat] = data.locations.split(',')
        return {
          lat: parseFloat(lat),
          lon: parseFloat(lon)
        }
      }

      throw new Error('坐标转换失败')
    } catch (error) {
      console.warn('[逆地理编码] 坐标转换失败，使用原始坐标:', error)
      return { lat: latitude, lon: longitude }
    }
  }

  /**
   * 逆地理编码：将经纬度转换为具体地理位置
   * 使用高德地图逆地理编码API
   */
  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodingResult> {
    try {
      // 直接调用高德逆地理编码API（使用WGS84坐标，会有少量偏移但可接受）
      const response = await fetch(
        `${this.AMAP_BASE_URL}/v3/geocode/regeo?key=${this.AMAP_API_KEY}&location=${longitude},${latitude}&extensions=all&output=json`,
        {
          signal: AbortSignal.timeout(10000) // 10秒超时
        }
      )

      if (!response.ok) {
        throw new Error(`逆地理编码请求失败: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.status !== '1') {
        throw new Error(`逆地理编码API返回错误: ${data.info}`)
      }

      const regeocode = data.regeocode
      const addressComponent = regeocode.addressComponent || {}
      const formattedAddress = regeocode.formatted_address || ''

      // 提取各个级别的地理位置信息
      const country = addressComponent.country || ''
      const province = addressComponent.province || ''
      const city = (Array.isArray(addressComponent.city) ? '' : (addressComponent.city || addressComponent.province || ''))
      const district = addressComponent.district || ''
      const street = addressComponent.township || ''
      const streetNumber = addressComponent.streetNumber?.street || ''
      const adcode = addressComponent.adcode || ''

      // 提取POI信息（附近的兴趣点）
      const pois = regeocode.pois?.map((poi: any) => ({
        name: poi.name,
        address: poi.address,
        distance: poi.distance
      })) || []

      // 构建简化的格式化地址（优先显示中文信息）
      const formatted_address_parts: string[] = []
      if (country) formatted_address_parts.push(country)
      if (province) formatted_address_parts.push(province)
      if (city) formatted_address_parts.push(city)
      if (district) formatted_address_parts.push(district)
      if (street) formatted_address_parts.push(street)
      if (streetNumber) formatted_address_parts.push(streetNumber)

      const formatted_address = formatted_address_parts.join('') || formattedAddress

      console.log('[逆地理编码] 高德API返回:', {
        formatted_address,
        formattedAddress,
        province,
        city,
        district,
        pois: pois.length
      })

      return {
        formatted_address,
        country,
        province,
        city,
        district,
        street: streetNumber,
        full_location_text: formattedAddress,
        adcode,
        pois
      }
    } catch (error) {
      console.error('[逆地理编码] 高德API失败，使用本地坐标范围判断:', error)

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
   * 中国主要城市坐标范围数据（用于简化的地理位置判断）
   */
  private getLocationByCoordinates(latitude: number, longitude: number): { province: string, city: string } | null {
    const CITY_REGIONS = [
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
    ]

    for (const region of CITY_REGIONS) {
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
   * 批量逆地理编码
   */
  async batchReverseGeocode(locations: Array<{ latitude: number; longitude: number }>): Promise<ReverseGeocodingResult[]> {
    const results = await Promise.all(
      locations.map(loc => this.reverseGeocode(loc.latitude, loc.longitude))
    )
    return results
  }
}
