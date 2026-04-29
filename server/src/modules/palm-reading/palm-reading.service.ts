import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import axios from 'axios';
import * as FormData from 'form-data';
import * as sharp from 'sharp';

@Injectable()
export class PalmReadingService {
  private readonly imageApiUrl = 'https://api.aaigc.top/v1/images/edits';
  private readonly imageApiKey = 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';

  constructor(
    private configService: ConfigService,
    private storageService: StorageService
  ) {}

  /**
   * 下载图片并压缩，返回 buffer
   */
  private async downloadAndCompressImage(imageUrl: string): Promise<Buffer> {
    console.log('[PalmReadingService] 下载并压缩图片...', imageUrl);

    const imgResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    const originalBuffer = Buffer.from(imgResponse.data, 'binary');
    console.log('[PalmReadingService] 原始图片大小:', originalBuffer.length, 'bytes');

    // 压缩图片：最大宽度1024px，转为PNG保持质量
    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(originalBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .png({ quality: 90 })
        .toBuffer();
      console.log('[PalmReadingService] 压缩后大小:', compressedBuffer.length, 'bytes');
    } catch (e) {
      console.log('[PalmReadingService] sharp压缩失败，使用原图:', e.message);
      compressedBuffer = originalBuffer;
    }

    return compressedBuffer;
  }

  /**
   * 用图片编辑接口基于手掌原图生成掌相阅读指南图
   */
  async generatePalmReading(imageUrl: string): Promise<{
    generatedImageUrl: string;
  }> {
    try {
      console.log('[PalmReadingService] ========== 开始掌相阅读 ==========');
      console.log('[PalmReadingService] 手掌图片URL:', imageUrl);

      // 下载并压缩图片
      const imageBuffer = await this.downloadAndCompressImage(imageUrl);

      // 用户原始提示词
      const prompt = `根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能`;

      // 使用 multipart/form-data 格式发送请求
      const formData = new FormData();
      formData.append('model', 'gpt-image-2-all');
      formData.append('prompt', prompt);
      formData.append('image', imageBuffer, {
        filename: 'palm.png',
        contentType: 'image/png'
      });
      formData.append('n', '1');
      formData.append('size', '1024x1024');

      console.log('[PalmReadingService] 发送图片编辑请求到 /v1/images/edits ...');

      const response = await axios.post(this.imageApiUrl, formData, {
        headers: {
          'Authorization': `Bearer ${this.imageApiKey}`,
          ...formData.getHeaders()
        },
        timeout: 300000
      });

      console.log('[PalmReadingService] 图片API响应状态:', response.status);

      if (response.data && response.data.data && response.data.data.length > 0) {
        const imageData = response.data.data[0];

        if (imageData.b64_json) {
          console.log('[PalmReadingService] 上传base64图片到TOS...');
          const timestamp = Date.now();
          const filename = `palm-reading-${timestamp}.png`;
          const tosUrl = await this.storageService.uploadBase64Image(
            `data:image/png;base64,${imageData.b64_json}`,
            filename
          );
          console.log('[PalmReadingService] 图片上传成功:', tosUrl);
          return { generatedImageUrl: tosUrl };
        } else if (imageData.url) {
          console.log('[PalmReadingService] 获取到临时URL，下载并上传到TOS...');
          const timestamp = Date.now();
          const filename = `palm-reading-${timestamp}.png`;
          const tempImgResponse = await axios.get(imageData.url, {
            responseType: 'arraybuffer',
            timeout: 60000
          });
          const base64 = Buffer.from(tempImgResponse.data, 'binary').toString('base64');
          const tosUrl = await this.storageService.uploadBase64Image(
            `data:image/png;base64,${base64}`,
            filename
          );
          console.log('[PalmReadingService] 图片上传成功:', tosUrl);
          return { generatedImageUrl: tosUrl };
        } else {
          throw new HttpException('生成失败，无图片数据返回', HttpStatus.INTERNAL_SERVER_ERROR);
        }
      } else {
        throw new HttpException('生成失败，响应格式错误', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } catch (error: any) {
      console.error('[PalmReadingService] 掌相阅读失败:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      if (error.response) {
        console.error('[PalmReadingService] API错误响应:', {
          status: error.response.status,
          data: typeof error.response.data === 'string' 
            ? error.response.data.substring(0, 500) 
            : JSON.stringify(error.response.data).substring(0, 500)
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
