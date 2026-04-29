import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { LLMClient, Config as LLMConfig, Message } from 'coze-coding-dev-sdk';
import axios from 'axios';

@Injectable()
export class PalmReadingService {
  private readonly imageApiUrl = 'https://api.aaigc.top/v1/images/generations';
  private readonly imageApiKey = 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';

  constructor(
    private configService: ConfigService,
    private storageService: StorageService
  ) {}

  /**
   * 第一步：用视觉模型分析手掌，获取掌纹分析文字
   */
  private async analyzePalm(imageUrl: string): Promise<string> {
    console.log('[PalmReadingService] 第一步：视觉模型分析手掌...');

    const config = new LLMConfig();
    const client = new LLMClient(config);

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
              url: imageUrl,
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
   * 第二步：用图片生成API生成掌相分析图
   */
  private async generatePalmImage(analysis: string): Promise<string> {
    console.log('[PalmReadingService] 第二步：生成掌相分析图...');

    // 把分析内容截取关键信息用于图片生成
    const analysisSummary = analysis.substring(0, 500);

    const prompt = `Create a premium palm reading analysis card image. The image should have:
- Left side: A realistic open palm with elegantly drawn colored lines tracing palm lines (red for life line 生命线, pink for heart line 感情线, blue for head line 智慧线, gold for fate line 命运线), each line labeled in Chinese
- Right side: A clean white card with rounded corners containing Chinese text analysis of the palm reading, organized in sections with elegant icons
- Overall style: minimalist, premium, soft purple-blue gradient background, thin elegant lines, high-end design
- Text should include key personality traits and fortune analysis in Chinese

Reference analysis: ${analysisSummary}`;

    const requestData = {
      model: 'gpt-image-2',
      prompt: prompt,
      n: 1,
      size: '1024x1024'
    };

    console.log('[PalmReadingService] 图片生成请求参数:', {
      model: requestData.model,
      promptLength: prompt.length,
      n: requestData.n,
      size: requestData.size
    });

    const response = await axios.post(this.imageApiUrl, requestData, {
      headers: {
        'Authorization': `Bearer ${this.imageApiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 180000
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
        console.log('[PalmReadingService] 生成成功，图片URL:', imageData.url);
        return imageData.url;
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

      // 第一步：视觉模型分析手掌
      const analysis = await this.analyzePalm(imageUrl);

      if (!analysis || analysis.length < 50) {
        throw new HttpException('掌相分析失败，请重试', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      console.log('[PalmReadingService] 掌相分析完成，开始生成图片...');

      // 第二步：生成掌相分析图
      const generatedImageUrl = await this.generatePalmImage(analysis);

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
