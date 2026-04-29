import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { LLMClient, Config as LLMConfig, Message } from 'coze-coding-dev-sdk';
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
   * 下载图片并压缩，返回 base64 和 buffer
   */
  private async downloadAndCompressImage(imageUrl: string): Promise<{
    base64: string;
    buffer: Buffer;
  }> {
    console.log('[PalmReadingService] 下载并压缩图片...', imageUrl);

    const imgResponse = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 60000
    });
    const originalBuffer = Buffer.from(imgResponse.data, 'binary');
    console.log('[PalmReadingService] 原始图片大小:', originalBuffer.length, 'bytes');

    // 压缩图片：最大宽度1024px，质量80%，转为JPEG减小体积
    let compressedBuffer: Buffer;
    try {
      compressedBuffer = await sharp(originalBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      console.log('[PalmReadingService] 压缩后大小:', compressedBuffer.length, 'bytes');
    } catch (e) {
      console.log('[PalmReadingService] sharp压缩失败，使用原图:', e.message);
      compressedBuffer = originalBuffer;
    }

    const base64 = compressedBuffer.toString('base64');
    return { base64, buffer: compressedBuffer };
  }

  /**
   * 第一步：用视觉模型分析手掌，获取掌纹分析文字
   */
  private async analyzePalm(imageBase64: string): Promise<string> {
    console.log('[PalmReadingService] 第一步：视觉模型分析手掌...');

    const config = new LLMConfig();
    const client = new LLMClient(config);

    // 用 base64 传图，避免视觉模型端下载大文件超时
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`;

    const messages: Message[] = [
      {
        role: 'system',
        content: '你是一位专业的掌相大师，擅长分析手掌纹路并提供详细的掌相解读。请用中文回答。'
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `请仔细分析这张手掌照片，按照以下格式输出掌相分析：

【掌纹识别】
请识别并描述以下掌纹的位置、长度、深浅、走向特征：
1. 生命线（地纹）：从虎口下方环绕拇指根部
2. 感情线（天纹）：手掌上方横纹
3. 智慧线（人纹）：手掌中间横纹
4. 命运线（事业线）：手掌中间竖纹（如有）
5. 婚姻线：感情线上方短纹（如有）

【性格分析】
根据掌纹特征分析此人性格

【运势解读】
- 事业运
- 感情运
- 健康运

【综合建议】
给出3条生活建议`
          },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
              detail: 'high'
            }
          }
        ]
      }
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.7
    });

    console.log('[PalmReadingService] 视觉分析完成，内容长度:', response.content?.length);
    return response.content;
  }

  /**
   * 第二步：用图片编辑接口基于原图生成标注了掌纹的分析图
   */
  private async generatePalmImage(imageBuffer: Buffer): Promise<string> {
    console.log('[PalmReadingService] 第二步：基于原图生成掌纹标注图...');

    const prompt = `请在这张手掌照片上，用彩色线条标注出主要的掌纹，并加上中文标签：
- 用红色线条标注生命线，旁边写"生命线"
- 用蓝色线条标注感情线，旁边写"感情线"  
- 用绿色线条标注智慧线，旁边写"智慧线"
- 用橙色线条标注命运线（如有），旁边写"命运线"
保持原始手掌照片不变，只在上面叠加标注线条和文字标签。线条要细而清晰。`;

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

    console.log('[PalmReadingService] 发送图片编辑请求...');

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
        return tosUrl;
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
        return tosUrl;
      } else {
        throw new HttpException('生成失败，无图片数据返回', HttpStatus.INTERNAL_SERVER_ERROR);
      }
    } else {
      throw new HttpException('生成失败，响应格式错误', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * 完整的掌相阅读流程：分析 + 生成图
   */
  async generatePalmReading(imageUrl: string): Promise<{
    analysis: string;
    generatedImageUrl: string;
  }> {
    try {
      console.log('[PalmReadingService] ========== 开始掌相阅读 ==========');
      console.log('[PalmReadingService] 手掌图片URL:', imageUrl);

      // 先下载并压缩图片（避免后续重复下载，也避免视觉模型下载超时）
      const { base64, buffer } = await this.downloadAndCompressImage(imageUrl);

      // 第一步：视觉模型分析手掌（用base64传图）
      const analysis = await this.analyzePalm(base64);

      if (!analysis || analysis.length < 50) {
        throw new HttpException('掌相分析失败，请重试', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      console.log('[PalmReadingService] 掌相分析完成，开始生成图片...');

      // 第二步：基于原图生成掌纹标注图（用buffer传图）
      const generatedImageUrl = await this.generatePalmImage(buffer);

      console.log('[PalmReadingService] ========== 掌相阅读完成 ==========');

      return {
        analysis,
        generatedImageUrl
      };
    } catch (error: any) {
      console.error('[PalmReadingService] 掌相阅读失败:', error);

      if (error instanceof HttpException) {
        throw error;
      }

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
