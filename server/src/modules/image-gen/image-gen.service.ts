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
   * 生成图片 - 调用 OpenAI 兼容的图片生成 API
   */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const { userId, prompt, style = 'realistic', size = '1024x1024', n = 1 } = params;

    console.log(`[ImageGenService] generate: userId=${userId}, prompt="${prompt.slice(0, 50)}", style=${style}, size=${size}`);

    // 增强提示词
    const enhancedPrompt = this.buildEnhancedPrompt(prompt, style);

    // 调用图片生成 API
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
        prompt: enhancedPrompt,
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
    // OpenAI 格式: { data: [{ url: "https://..." }, { b64_json: "..." }] }
    let imageUrl = '';

    if (result.data && Array.isArray(result.data) && result.data.length > 0) {
      const firstItem = result.data[0];
      if (firstItem.url) {
        imageUrl = firstItem.url;
      } else if (firstItem.b64_json) {
        // base64 格式需要转为可访问的 URL（上传到对象存储）
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
          JSON.stringify({ style, size, enhancedPrompt, model: this.model, apiResponse: { created: result.created } }),
        ]
      );
      console.log('[ImageGenService] 保存记录成功, id:', recordId);
    } catch (dbError: any) {
      console.error('[ImageGenService] 保存记录失败:', dbError.message);
      // 数据库保存失败不影响返回结果
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
      list: (Array.isArray(rows) ? rows : []).map((r: any) => ({
        id: r.id,
        prompt: r.prompt,
        url: r.images,
        style: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata).style : r.metadata?.style) : undefined,
        size: r.metadata ? (typeof r.metadata === 'string' ? JSON.parse(r.metadata).size : r.metadata?.size) : undefined,
        status: r.status,
        createdAt: r.created_at,
      })),
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

    return {
      id: record.id,
      prompt: record.prompt,
      url: record.images,
      result: record.result ? (typeof record.result === 'string' ? JSON.parse(record.result) : record.result) : null,
      metadata: record.metadata ? (typeof record.metadata === 'string' ? JSON.parse(record.metadata) : record.metadata) : null,
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

  private buildEnhancedPrompt(prompt: string, style: string): string {
    const styleEnhancements: Record<string, string> = {
      realistic: 'photorealistic, high detail, professional photography, 8k resolution',
      anime: 'anime style, vibrant colors, clean lines, Japanese animation aesthetic',
      oil_painting: 'oil painting style, rich textures, classical art, masterpiece',
      watercolor: 'watercolor painting, soft colors, artistic, dreamy atmosphere',
      sketch: 'pencil sketch, detailed linework, artistic drawing, monochrome',
      poster: 'poster design, bold typography, eye-catching, professional layout',
      logo: 'logo design, minimalist, clean, professional branding',
      '3d': '3D render, realistic lighting, detailed textures, high quality',
    };
    const enhancement = styleEnhancements[style] || styleEnhancements.realistic;
    return `${prompt}, ${enhancement}, high quality, detailed`;
  }
}
