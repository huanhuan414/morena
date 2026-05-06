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
  async createTask(imageUrl: string, avatarId?: string, userId?: string): Promise<PalmReadingRecord> {
    const { data, error } = await this.supabase
      .from('palm_reading_records')
      .insert({
        avatar_id: avatarId || null,
        palm_image_url: imageUrl,
        status: 'pending',
        progress: '任务已创建',
        user_id: userId || null,
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

      const prompt = `Create a comprehensive Chinese palm reading guide poster based on my palm photo.

LAYOUT (vertical poster, white/light background, minimalist high-end style, fine lines, rounded cards):

TOP SECTION:
- Title "掌相阅读指南" centered, subtitle "了解天赋·把握机遇·成就更好的自己"
- My ORIGINAL palm photo displayed as-is (do NOT redraw or modify my hand)
- Next to the photo, annotate the main palm lines with labels: 生命线(Life line), 感情线(Heart line), 智慧线(Head line), 命运线(Fate line), 太阳线(Sun line)

IMPORTANT - PALM LINE DIAGRAM SECTION (must include):
- Create a clean black-and-white outline drawing of MY palm (based on my actual palm shape and line positions)
- Draw the main palm lines as distinct colored strokes on the outline: 生命线 in RED, 感情线 in BLUE, 智慧线 in GREEN, 命运线 in ORANGE, 太阳线 in PURPLE
- Label each line with its Chinese name and a brief 1-line description
- This diagram should look like an artistic minimalist illustration, NOT a photo

MIDDLE SECTION:
- Left card: 掌型与手指分析 (hand shape features, thumb/index/middle/ring/little finger meanings)
- Right card: 主要掌纹解读 (detailed meaning of each palm line with small icons)

BOTTOM SECTION:
- Left: 整体掌相总结 (3 core personality traits and talents)
- Center: 人生建议 (4 concise life advice points)
- Right: 发展方向与运势评分 (career/wealth/love/health/benefactor fortune scores as progress bars or numbers)
- Bottom line: "命运在你手中，选择与努力让未来更美好"

STYLE: All text in Chinese. Fine lines, rounded cards, minimalist black-white palette with accent colors. Professional and elegant like a premium design piece.`;

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

  async getHistory(userId?: string, avatarId?: string, page = 1, limit = 10): Promise<{ records: PalmReadingRecord[]; total: number }> {
    const offset = (page - 1) * limit;

    // 先查总数
    let countQuery = this.supabase.from('palm_reading_records').select('*', { count: 'exact', head: true });
    if (userId) {
      countQuery = countQuery.eq('user_id', userId);
    } else if (avatarId) {
      countQuery = countQuery.eq('avatar_id', avatarId);
    }
    const { count } = await countQuery;

    // 再查分页数据
    let dataQuery = this.supabase
      .from('palm_reading_records')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (userId) {
      dataQuery = dataQuery.eq('user_id', userId);
    } else if (avatarId) {
      dataQuery = dataQuery.eq('avatar_id', avatarId);
    }
    const { data, error } = await dataQuery;

    if (error) {
      throw new Error(`查询历史失败: ${error.message}`);
    }

    return { records: (data || []) as PalmReadingRecord[], total: count || 0 };
  }

  /**
   * 删除指定记录（需验证用户ID）
   */
  async deleteRecord(id: string, userId?: string): Promise<void> {
    // 如果提供了 userId，先验证记录是否属于该用户
    if (userId) {
      const { data } = await this.supabase
        .from('palm_reading_records')
        .select('user_id')
        .eq('id', id)
        .single();

      if (data && data.user_id && data.user_id !== userId) {
        throw new Error('无权删除此记录');
      }
    }

    const { error } = await this.supabase.from('palm_reading_records').delete().eq('id', id);
    if (error) {
      throw new Error(`删除记录失败: ${error.message}`);
    }
  }

  /**
   * 清空所有历史记录（按用户ID）
   */
  async clearHistory(userId?: string, avatarId?: string): Promise<void> {
    let query = this.supabase.from('palm_reading_records').delete();
    if (userId) {
      query = query.eq('user_id', userId);
    } else if (avatarId) {
      query = query.eq('avatar_id', avatarId);
    }
    const { error } = await query;
    if (error) {
      throw new Error(`清空历史失败: ${error.message}`);
    }
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
