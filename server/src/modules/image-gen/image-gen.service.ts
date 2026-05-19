import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import * as crypto from 'crypto';

interface ImageGenParams {
  userId: string;
  prompt: string;
  style?: string;
  size?: string;
  n?: number;
}

interface ImageGenResult {
  id: string;
  url: string;
  prompt: string;
  style: string;
  size: string;
  createdAt: string;
}

@Injectable()
export class ImageGenService {
  private readonly baseUrl = process.env.IMAGE_GEN_API_BASE_URL || 'https://api.aaigc.top';
  private readonly apiKey = process.env.IMAGE_GEN_API_KEY || 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';
  private readonly model = process.env.IMAGE_GEN_MODEL || 'gpt-image-2-all';

  /**
   * 确保用户记录存在于 users 表，避免外键约束报错
   */
  private async ensureUserExists(userId: string): Promise<void> {
    const pool = getPool();
    const [rows] = await pool.query('SELECT id FROM users WHERE id = ?', [userId]) as any;
    if (rows.length === 0) {
      await pool.query(
        `INSERT IGNORE INTO users (id, openid, nickname, level, exp, credits, created_at, updated_at)
         VALUES (?, ?, ?, 1, 0, 0, NOW(), NOW())`,
        [userId, `auto_${userId}`, `用户${userId.slice(0, 6)}`]
      );
      console.log('[ImageGenService] 自动创建用户记录, userId:', userId);
    }
  }

  /**
   * 生成图片 - 直接将用户描述发送给图片生成API
   */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const { userId, prompt, style = 'realistic', size = '1024x1536', n = 1 } = params;

    console.log(`[ImageGenService] generate: userId=${userId}, prompt="${prompt.slice(0, 50)}", style=${style}, size=${size}`);

    const apiUrl = `${this.baseUrl}/v1/images/generations`;
    console.log(`[ImageGenService] calling API: ${apiUrl}, model: ${this.model}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        prompt,
        n,
        size,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[ImageGenService] API error: ${response.status} ${errorText}`);
      throw new Error(`图片生成API错误: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const result = await response.json() as any;
    console.log(`[ImageGenService] API response:`, JSON.stringify(result).slice(0, 300));

    // 解析返回的图片 URL
    let imageUrl = '';

    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const firstItem = result.data[0];
      if (firstItem.url) {
        imageUrl = firstItem.url;
      } else if (firstItem.b64_json) {
        imageUrl = `data:image/png;base64,${firstItem.b64_json}`;
      }
    }

    if (!imageUrl) {
      throw new Error('图片生成返回数据为空');
    }

    console.log(`[ImageGenService] 图片生成成功, url: ${imageUrl.slice(0, 80)}...`);

    // 保存记录到数据库
    const recordId = crypto.randomUUID();
    try {
      const pool = getPool();
      await this.ensureUserExists(userId);
      await pool.query(
        `INSERT INTO generated_content (id, user_id, avatar_id, task_id, type, order_id, content_type, prompt, result, images, video_url, status, metadata, created_at)
         VALUES (?, ?, NULL, NULL, ?, NULL, ?, ?, ?, ?, NULL, ?, ?, NOW())`,
        [
          recordId,
          userId,
          'image',
          'image',
          prompt,
          JSON.stringify({ url: imageUrl, style, size, model: this.model }),
          imageUrl,
          'completed',
          JSON.stringify({ style, size, model: this.model, apiResponse: { created: result.created } }),
        ]
      );
      console.log('[ImageGenService] 保存记录成功, id:', recordId);
    } catch (dbError: any) {
      console.error('[ImageGenService] 保存记录失败:', dbError.message);
    }

    return {
      id: recordId,
      url: imageUrl,
      prompt,
      style,
      size,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * 获取用户的图片生成历史
   */
  async getHistory(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT id, prompt, images, content_type, metadata, status, created_at 
       FROM generated_content 
       WHERE user_id = ? AND content_type = 'image' 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM generated_content WHERE user_id = ? AND content_type = 'image'`,
      [userId]
    );

    const countData = countRows as any[];
    const total = countData[0]?.total || 0;

    return {
      list: (Array.isArray(rows) ? rows : []).map((r: any) => {
        let meta = r.metadata;
        if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }
        return {
          id: r.id,
          prompt: r.prompt,
          url: r.images,
          style: meta?.style,
          size: meta?.size,
          status: r.status,
          createdAt: r.created_at,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取单条图片详情
   */
  async getById(id: string, userId: string) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, prompt, images, result, metadata, status, created_at FROM generated_content WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    const record = Array.isArray(rows) ? (rows as any[])[0] : null;
    if (!record) {
      return null;
    }

    let meta = record.metadata;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }

    let resultData = record.result;
    if (typeof resultData === 'string') { try { resultData = JSON.parse(resultData); } catch { resultData = {}; } }

    return {
      id: record.id,
      prompt: record.prompt,
      url: record.images,
      result: resultData,
      metadata: meta,
      status: record.status,
      createdAt: record.created_at,
    };
  }

  /**
   * 删除图片记录
   */
  async delete(id: string, userId: string) {
    const pool = getPool();
    await pool.query('DELETE FROM generated_content WHERE id = ? AND user_id = ?', [id, userId]);
    return true;
  }
}
