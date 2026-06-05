import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import * as crypto from 'crypto';
import { S3Storage } from 'coze-coding-dev-sdk';

interface VideoGenParams {
  userId: string;
  prompt: string;
  duration?: number;
  ratio?: string;
}

interface VideoGenResult {
  id: string;
  url: string;
  prompt: string;
  duration: number;
  ratio: string;
  createdAt: string;
}

@Injectable()
export class VideoGenService {
  private readonly seedanceApiKey = process.env.SEEDANCE_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47';
  private readonly seedanceBaseUrl = process.env.SEEDANCE_BASE_URL || 'https://ark.cn-beijing.volces.com';
  private readonly seedanceModel = process.env.SEEDANCE_MODEL || 'doubao-seedance-2-0-260128';

  private storage: S3Storage;

  constructor() {
    this.storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL || 'https://tos-cn-guangzhou.volces.com',
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      bucketName: process.env.COZE_BUCKET_NAME || 'morena-ai',
      region: 'cn-guangzhou',
    });
  }

  async generate(params: VideoGenParams): Promise<VideoGenResult> {
    const { userId, prompt, duration = 5, ratio = '9:16' } = params;

    const createUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks`;
    console.log(`[VideoGenService] 创建视频任务, prompt: ${prompt.slice(0, 80)}...`);

    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.seedanceApiKey}`,
      },
      body: JSON.stringify({
        model: this.seedanceModel,
        content: [{ type: 'text', text: prompt }],
        duration,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error(`[VideoGenService] 创建任务失败: ${createResponse.status} ${errorText.slice(0, 200)}`);
      throw new Error(`视频生成API错误: ${createResponse.status}`);
    }

    const createResult = await createResponse.json() as any;
    const taskId = createResult?.id;
    if (!taskId) {
      throw new Error('视频生成返回无任务ID');
    }

    console.log(`[VideoGenService] 任务已创建: ${taskId}`);

    const videoUrl = await this.pollTask(taskId);
    if (!videoUrl) {
      throw new Error('视频生成超时');
    }

    console.log(`[VideoGenService] 视频生成完成，上传CDN...`);
    const videoKey = await this.storage.uploadFromUrl({ url: videoUrl, timeout: 60000 });
    const cdnUrl = await this.storage.generatePresignedUrl({ key: videoKey, expireTime: 86400 * 30 });

    const recordId = crypto.randomUUID();
    const pool = getPool();
    await pool.query(
      `INSERT INTO generated_content (id, user_id, type, content_type, prompt, url, storage_key, status, metadata, created_at)
       VALUES (?, ?, 'video', 'video', ?, ?, ?, 'completed', ?, NOW())`,
      [
        recordId,
        userId,
        prompt,
        cdnUrl,
        videoKey,
        JSON.stringify({ duration, ratio, model: this.seedanceModel }),
      ]
    );

    return {
      id: recordId,
      url: cdnUrl,
      prompt,
      duration,
      ratio,
      createdAt: new Date().toISOString(),
    };
  }

  private async pollTask(taskId: string): Promise<string | null> {
    const maxAttempts = 60;
    const pollInterval = 5000;

    for (let i = 0; i < maxAttempts; i++) {
      const pollUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks/${taskId}`;
      const pollResponse = await fetch(pollUrl, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${this.seedanceApiKey}` },
      });

      if (!pollResponse.ok) {
        throw new Error(`轮询任务失败: ${pollResponse.status}`);
      }

      const pollResult = await pollResponse.json() as any;
      const status = pollResult?.status;

      if (status === 'completed' || status === 'success') {
        const videoUrl = pollResult?.output?.video_url || pollResult?.video_url;
        if (videoUrl) {
          return videoUrl;
        }
        throw new Error('视频生成完成但无URL');
      }

      if (status === 'failed' || status === 'error') {
        const errorMsg = pollResult?.error?.message || pollResult?.error_message || '未知错误';
        throw new Error(`视频生成失败: ${errorMsg}`);
      }

      console.log(`[VideoGenService] 轮询 ${i + 1}/${maxAttempts}, status: ${status}`);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    return null;
  }

  async getHistory(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const pool = getPool();

    const [rows] = await pool.query(
      `SELECT id, prompt, url, metadata, status, created_at 
       FROM generated_content 
       WHERE user_id = ? AND content_type = 'video' 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM generated_content WHERE user_id = ? AND content_type = 'video'`,
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
          url: r.url,
          duration: meta?.duration,
          ratio: meta?.ratio,
          status: r.status,
          createdAt: r.created_at,
        };
      }),
      total,
      page,
      pageSize,
    };
  }

  async getById(id: string, userId: string) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, prompt, url, metadata, status, created_at FROM generated_content WHERE id = ? AND user_id = ?`,
      [id, userId]
    );

    const record = Array.isArray(rows) ? (rows as any[])[0] : null;
    if (!record) {
      return null;
    }

    let meta = record.metadata;
    if (typeof meta === 'string') { try { meta = JSON.parse(meta); } catch { meta = {}; } }

    return {
      id: record.id,
      prompt: record.prompt,
      url: record.url,
      metadata: meta,
      status: record.status,
      createdAt: record.created_at,
    };
  }

  async delete(id: string, userId: string) {
    const pool = getPool();
    await pool.query('DELETE FROM generated_content WHERE id = ? AND user_id = ?', [id, userId]);
    return true;
  }
}
