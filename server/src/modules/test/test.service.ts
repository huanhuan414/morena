import { Injectable } from '@nestjs/common'
import axios from 'axios'

@Injectable()
export class TestService {
  async testTikHubAPI() {
    try {
      console.log('[TestService] 开始测试 TikHub API')

      const response = await axios.get(
        'https://api.tikhub.io/api/v1/douyin/app/v3/fetch_one_video_by_share_url',
        {
          params: {
            share_url: 'https://www.douyin.com/video/7111111111111111111'
          },
          headers: {
            'Authorization': 'Bearer iawtA+4A7Gr1hkOTKq2M5SfzahTUd5h4uUjatHyZS/m90wqBB2yqURXBKw==',
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      )

      console.log('[TestService] API 调用成功:', response.status)
      console.log('[TestService] 响应数据:', JSON.stringify(response.data, null, 2))

      return response.data
    } catch (error: any) {
      console.error('[TestService] API 调用失败:', error.message)
      console.error('[TestService] 错误详情:', error.response?.data || error)
      throw error
    }
  }
}
