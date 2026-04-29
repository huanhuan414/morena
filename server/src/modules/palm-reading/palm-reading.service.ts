import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import * as https from 'https';
import * as FormData from 'form-data';
import * as sharp from 'sharp';

@Injectable()
export class PalmReadingService {
  private readonly imageApiUrl = 'https://api.aaigc.top/v1/images/edits';
  private readonly imageApiKey = 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';

  constructor(
    private storageService: StorageService
  ) {}

  /**
   * 下载图片并压缩，返回 buffer
   */
  private async downloadAndCompressImage(imageUrl: string): Promise<Buffer> {
    console.log('[PalmReadingService] 下载并压缩图片...', imageUrl);

    return new Promise((resolve, reject) => {
      https.get(imageUrl, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载图片失败: HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', async () => {
          try {
            const originalBuffer = Buffer.concat(chunks);
            console.log('[PalmReadingService] 原始图片大小:', originalBuffer.length, 'bytes');

            let compressedBuffer: Buffer;
            try {
              compressedBuffer = await sharp(originalBuffer)
                .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
                .jpeg({ quality: 85 })
                .toBuffer();
              console.log('[PalmReadingService] 压缩后大小:', compressedBuffer.length, 'bytes');
            } catch (e) {
              console.log('[PalmReadingService] sharp压缩失败，使用原图:', e.message);
              compressedBuffer = originalBuffer;
            }

            resolve(compressedBuffer);
          } catch (e) {
            reject(e);
          }
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }

  /**
   * 用原生 https 发送 multipart/form-data 请求
   */
  private async sendImageEditRequest(formData: FormData): Promise<any> {
    return new Promise((resolve, reject) => {
      const formHeaders = formData.getHeaders();

      const options = {
        hostname: 'api.aaigc.top',
        path: '/v1/images/edits',
        method: 'POST',
        headers: {
          ...formHeaders,
          'Authorization': `Bearer ${this.imageApiKey}`,
        },
        timeout: 600000, // 10分钟超时
      };

      console.log('[PalmReadingService] 发送请求到 /v1/images/edits ...');

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          try {
            const body = Buffer.concat(chunks).toString('utf8');
            console.log('[PalmReadingService] API响应状态:', res.statusCode);

            if (res.statusCode !== 200) {
              console.error('[PalmReadingService] API错误响应:', body.substring(0, 500));
              reject(new Error(`API返回错误: HTTP ${res.statusCode} - ${body.substring(0, 200)}`));
              return;
            }

            const data = JSON.parse(body);
            resolve(data);
          } catch (e) {
            reject(new Error(`解析API响应失败: ${e.message}`));
          }
        });
        res.on('error', reject);
      });

      req.on('timeout', () => {
        console.error('[PalmReadingService] 请求超时(10分钟)');
        req.destroy();
        reject(new Error('图片编辑请求超时，请稍后重试'));
      });

      req.on('error', (e) => {
        console.error('[PalmReadingService] 请求错误:', e.message);
        reject(new Error(`网络请求失败: ${e.message}`));
      });

      // 将formData pipe到request
      formData.pipe(req);
    });
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

      // Step 1: 下载并压缩图片
      const imageBuffer = await this.downloadAndCompressImage(imageUrl);

      // Step 2: 构建提示词
      const prompt = `根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能`;

      // Step 3: 构建 multipart/form-data
      const formData = new FormData();
      formData.append('model', 'gpt-image-2-all');
      formData.append('prompt', prompt);
      formData.append('image', imageBuffer, {
        filename: 'palm.jpg',
        contentType: 'image/jpeg'
      });
      formData.append('n', '1');
      formData.append('size', '1024x1024');

      // Step 4: 发送请求（用原生https，避免axios超时问题）
      const response = await this.sendImageEditRequest(formData);

      // Step 5: 处理响应
      if (response.data && response.data.length > 0) {
        const imageData = response.data[0];

        if (imageData.b64_json) {
          console.log('[PalmReadingService] 获取到base64图片，上传到TOS...');
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
          const base64 = await this.downloadImageAsBase64(imageData.url);
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
      console.error('[PalmReadingService] 掌相阅读失败:', error.message || error);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        error.message || '掌相阅读生成失败',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * 下载图片并转为base64
   */
  private downloadImageAsBase64(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`下载图片失败: HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(buffer.toString('base64'));
        });
        res.on('error', reject);
      }).on('error', reject);
    });
  }
}
