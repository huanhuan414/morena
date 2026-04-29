import { Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { getSupabaseClient } from '../../storage/database/supabase-client';
import * as https from 'https';
import * as FormData from 'form-data';
import * as sharp from 'sharp';

export interface PalmReadingRecord {
  id: string;
  avatar_id: string | null;
  palm_image_url: string;
  generated_image_url: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: string;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class PalmReadingService {
  private readonly imageApiUrl = 'https://api.aaigc.top/v1/images/edits';
  private readonly imageApiKey = 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';

  constructor(private storageService: StorageService) {}

  private get supabase() {
    return getSupabaseClient();
  }

  /**
   * 创建任务并异步执行
   */
  async createTask(imageUrl: string, avatarId?: string): Promise<PalmReadingRecord> {
    const { data, error } = await this.supabase
      .from('palm_reading_records')
      .insert({
        avatar_id: avatarId || null,
        palm_image_url: imageUrl,
        status: 'pending',
        progress: '任务已创建',
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`创建记录失败: ${error?.message || '未知错误'}`);
    }

    const record = data as PalmReadingRecord;

    this.executeTask(record.id, imageUrl).catch((err) => {
      console.error('[PalmReadingService] 异步任务执行失败:', err.message);
    });

    return record;
  }

  /**
   * 异步执行生成任务
   */
  private async executeTask(taskId: string, imageUrl: string): Promise<void> {
    try {
      await this.updateTask(taskId, { status: 'processing', progress: '正在下载手掌图片...' });

      const imageBuffer = await this.downloadAndCompressImage(imageUrl);
      await this.updateTask(taskId, { progress: '图片已就绪，正在生成掌相阅读指南...' });

      const prompt = `根据我的手掌照片，制作一份完整的中文掌相阅读指南海报。

布局要求：
- 整体为竖版海报，白色/浅色背景，风格干净简约高端，细线条，圆角卡片
- 上方居中：标题"掌相阅读指南"，副标题"了解天赋·把握机遇·成就更好的自己"
- 上方区域：展示我的手掌原图（保持手掌照片原样），旁边标注主要掌纹位置和名称（生命线、感情线、智慧线、命运线、太阳线）
- 中部左侧：掌型与手指分析卡片（手型特点、拇指/食指/中指/无名指/小指各指含义）
- 中部右侧：主要掌纹解读卡片（每条掌纹的含义和特征，用小图标标识）
- 下部左侧：整体掌相总结（性格特点、优势天赋，列出3个核心特点）
- 下部中间：人生建议（4条简明建议）
- 下部右侧：适合发展方向和运势评分参考（事业运、财运、感情运、健康运、贵人运）
- 底部：一句话"命运在你手中，选择与努力让未来更美好"

内容要求：
- 所有文字必须用中文
- 掌纹分析要基于我的真实手掌照片，不要编造
- 各个板块用细线圆角卡片分隔
- 用简约的黑白配色，关键信息可用强调色
- 整体看起来高端专业，像一份精美的设计作品`;

      const formData = new FormData();
      formData.append('model', 'gpt-image-2-all');
      formData.append('prompt', prompt);
      formData.append('image', imageBuffer, {
        filename: 'palm.jpg',
        contentType: 'image/jpeg',
      });
      formData.append('n', '1');
      formData.append('size', '1024x1024');

      await this.updateTask(taskId, { progress: 'AI 正在绘制掌相指南（约1-5分钟）...' });

      const response = await this.sendImageEditRequest(formData);

      if (response.data && response.data.length > 0) {
        const imageData = response.data[0];
        let tosUrl: string;

        if (imageData.b64_json) {
          await this.updateTask(taskId, { progress: '正在保存生成的图片...' });
          const timestamp = Date.now();
          const filename = `palm-reading-${timestamp}.png`;
          tosUrl = await this.storageService.uploadBase64Image(
            `data:image/png;base64,${imageData.b64_json}`,
            filename,
          );
        } else if (imageData.url) {
          await this.updateTask(taskId, { progress: '正在保存生成的图片...' });
          const timestamp = Date.now();
          const filename = `palm-reading-${timestamp}.png`;
          const base64 = await this.downloadImageAsBase64(imageData.url);
          tosUrl = await this.storageService.uploadBase64Image(
            `data:image/png;base64,${base64}`,
            filename,
          );
        } else {
          throw new Error('生成失败，无图片数据返回');
        }

        await this.updateTask(taskId, {
          status: 'completed',
          progress: '生成完成',
          generated_image_url: tosUrl,
        });

        console.log('[PalmReadingService] 任务完成:', taskId, '图片:', tosUrl);
      } else {
        throw new Error('生成失败，响应格式错误');
      }
    } catch (error: any) {
      console.error('[PalmReadingService] 任务执行失败:', taskId, error.message);
      await this.updateTask(taskId, {
        status: 'failed',
        progress: '生成失败',
        error_message: error.message || '未知错误',
      });
    }
  }

  private async updateTask(
    taskId: string,
    updates: Partial<Pick<PalmReadingRecord, 'status' | 'progress' | 'generated_image_url' | 'error_message'>>,
  ): Promise<void> {
    const { error } = await this.supabase
      .from('palm_reading_records')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', taskId);

    if (error) {
      console.error('[PalmReadingService] 更新任务失败:', error.message);
    }
  }

  async getProgress(taskId: string): Promise<PalmReadingRecord> {
    const { data, error } = await this.supabase
      .from('palm_reading_records')
      .select('*')
      .eq('id', taskId)
      .single();

    if (error || !data) {
      throw new Error(`查询任务失败: ${error?.message || '任务不存在'}`);
    }

    return data as PalmReadingRecord;
  }

  async getHistory(avatarId?: string): Promise<PalmReadingRecord[]> {
    let query = this.supabase
      .from('palm_reading_records')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (avatarId) {
      query = query.eq('avatar_id', avatarId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`查询历史失败: ${error.message}`);
    }

    return (data || []) as PalmReadingRecord[];
  }

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

  private async sendImageEditRequest(formData: FormData): Promise<any> {
    return new Promise((resolve, reject) => {
      const formHeaders = formData.getHeaders();

      const options = {
        hostname: 'api.aaigc.top',
        path: '/v1/images/edits',
        method: 'POST',
        headers: {
          ...formHeaders,
          Authorization: `Bearer ${this.imageApiKey}`,
        },
        timeout: 600000,
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

      formData.pipe(req);
    });
  }

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
