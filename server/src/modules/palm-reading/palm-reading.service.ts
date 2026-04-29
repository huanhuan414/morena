import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import axios from 'axios';

@Injectable()
export class PalmReadingService {
  private readonly apiUrl = 'https://api.aaigc.top/v1/images/generations';
  private readonly apiKey = 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';

  constructor(
    private configService: ConfigService,
    private storageService: StorageService
  ) {}

  async generatePalmReading(imageUrl: string): Promise<{ generatedImageUrl: string }> {
    try {
      console.log('[PalmReadingService] 开始生成掌相阅读指南，图片URL:', imageUrl);

      // 固定的提示词
      const prompt = `根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能`;

      // 构建请求参数
      const requestData = {
        model: 'gpt-image-2',
        prompt: prompt,
        image: imageUrl,
        n: 1,
        size: '1024x1024'
      };

      console.log('[PalmReadingService] 请求参数:', {
        model: requestData.model,
        prompt: prompt.substring(0, 50) + '...',
        image: imageUrl,
        n: requestData.n,
        size: requestData.size
      });

      // 调用API
      const response = await axios.post(this.apiUrl, requestData, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 180000 // 180秒超时（3分钟）
      });

      console.log('[PalmReadingService] API响应状态:', response.status);
      console.log('[PalmReadingService] API响应数据:', response.data);

      // 解析响应
      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];

        // API 可能返回 b64_json (base64) 或 url
        if (imageData.url) {
          console.log('[PalmReadingService] 生成成功，图片URL:', imageData.url);
          return { generatedImageUrl: imageData.url };
        } else if (imageData.b64_json) {
          // 如果是 base64 编码的图片，上传到对象存储
          console.log('[PalmReadingService] API返回base64编码的图片，开始上传到TOS...');

          try {
            // 生成文件名
            const timestamp = Date.now();
            const filename = `palm-reading-${timestamp}.png`;

            // 上传到 TOS
            const imageUrl = await this.storageService.uploadBase64Image(
              `data:image/png;base64,${imageData.b64_json}`,
              filename
            );

            console.log('[PalmReadingService] 图片上传成功:', imageUrl);
            return { generatedImageUrl: imageUrl };
          } catch (uploadError: any) {
            console.error('[PalmReadingService] 上传图片到TOS失败:', uploadError);
            throw new HttpException('图片上传失败', HttpStatus.INTERNAL_SERVER_ERROR);
          }
        } else {
          console.error('[PalmReadingService] API响应中无图片数据:', imageData);
          throw new HttpException('生成失败，无图片数据返回', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        console.error('[PalmReadingService] 响应格式错误:', response.data);
        throw new HttpException('生成失败，响应格式错误', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error: any) {
      console.error('[PalmReadingService] 生成失败:', error);

      if (error.response) {
        console.error('[PalmReadingService] API错误响应:', {
          status: error.response.status,
          data: error.response.data
        });
        throw new HttpException(
          error.response.data?.error?.message || '生成失败',
          error.response.status || HttpStatus.INTERNAL_SERVER_ERROR
        );
      } else if (error.request) {
        throw new HttpException('网络请求失败，请稍后重试', HttpStatus.SERVICE_UNAVAILABLE);
      } else {
        throw new HttpException(
          error.message || '生成失败',
          HttpStatus.INTERNAL_SERVER_ERROR
        );
      }
    }
  }
}
