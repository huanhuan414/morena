import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import * as crypto from 'crypto';
import { VolcengineService } from '../upload/volcengine.service';

interface VideoGenParams {
  userId: string;
  prompt: string;
  duration?: number;
  ratio?: string;
  recordId?: string;
  coinConsumed?: number;
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

  constructor(private readonly volcengineService: VolcengineService) {}

  async startGenerate(params: VideoGenParams) {
    const recordId = crypto.randomUUID();
    const { userId, prompt, duration = 5, ratio = '9:16', coinConsumed = 0 } = params;
    const pool = getPool();
    await pool.query(
      `INSERT INTO generated_content (id, user_id, avatar_id, task_id, type, order_id, content_type, prompt, result, images, video_url, status, metadata, created_at, updated_at)
       VALUES (?, ?, NULL, NULL, 'video', NULL, 'video', ?, ?, NULL, NULL, 'pending', ?, NOW(), NOW())`,
      [
        recordId,
        userId,
        prompt,
        JSON.stringify({}),
        JSON.stringify({ duration, ratio, model: this.seedanceModel, coinConsumed }),
      ],
    );
    return { id: recordId, status: 'pending' };
  }

  async createQueuedTask(record: any): Promise<string> {
    const metadata = this.parseMetadata(record.metadata);
    const duration = Number(metadata.duration || 5);
    const createUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks`;
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.seedanceApiKey}`,
      },
      body: JSON.stringify({
        model: this.seedanceModel,
        content: [{ type: 'text', text: record.prompt }],
        duration,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`视频生成API错误: ${createResponse.status} ${errorText.slice(0, 200)}`);
    }

    const createResult = await createResponse.json() as any;
    const taskId = createResult?.id;
    if (!taskId) throw new Error('视频生成返回无任务ID');

    const pool = getPool();
    await pool.query(
      `UPDATE generated_content SET task_id = ?, metadata = ?, updated_at = NOW()
       WHERE id = ? AND status = 'generating'`,
      [
        taskId,
        JSON.stringify({ ...metadata, seedanceTaskId: taskId, startedAt: metadata.startedAt || new Date().toISOString() }),
        record.id,
      ],
    );
    return taskId;
  }

  async pollQueuedTask(record: any): Promise<{ state: 'running' | 'completed' | 'failed'; errorMessage?: string }> {
    const taskId = record.task_id;
    if (!taskId) return { state: 'running' };

    const pollUrl = `${this.seedanceBaseUrl}/api/v3/contents/generations/tasks/${taskId}`;
    const pollResponse = await fetch(pollUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${this.seedanceApiKey}` },
    });
    if (!pollResponse.ok) throw new Error(`查询视频任务失败: ${pollResponse.status}`);

    const pollResult = await pollResponse.json() as any;
    const status = pollResult?.status;
    if (status === 'failed' || status === 'error') {
      const rawMessage = pollResult?.error?.message || pollResult?.error_message || '视频生成失败';
      const errorMessage = String(rawMessage).includes('copyright restrictions')
        ? '提示词可能涉及受版权保护的角色或作品，请改用原创人物、场景和描述后重试'
        : String(rawMessage);
      return { state: 'failed', errorMessage };
    }

    if (!['completed', 'success', 'succeeded'].includes(status)) {
      return { state: 'running' };
    }

    const videoUrl = pollResult?.output?.video_url || pollResult?.content?.video_url || pollResult?.video_url;
    if (!videoUrl) return { state: 'failed', errorMessage: '视频生成完成但未返回视频地址' };

    const sourceResponse = await fetch(videoUrl);
    if (!sourceResponse.ok) {
      throw new Error(`下载生成视频失败: ${sourceResponse.status}`);
    }

    const videoBuffer = Buffer.from(await sourceResponse.arrayBuffer());
    if (videoBuffer.length === 0) {
      throw new Error('下载生成视频失败: 返回内容为空');
    }

    const uploadResult = await this.volcengineService.uploadVideo(videoBuffer, `${taskId}.mp4`);
    const cdnUrl = uploadResult.url;
    const metadata = this.parseMetadata(record.metadata);
    const pool = getPool();
    await pool.query(
      `UPDATE generated_content
       SET result = ?, video_url = ?, status = 'completed', metadata = ?, updated_at = NOW()
       WHERE id = ? AND status = 'generating'`,
      [
        JSON.stringify({ url: cdnUrl, duration: metadata.duration, ratio: metadata.ratio, model: this.seedanceModel }),
        cdnUrl,
        JSON.stringify({ ...metadata, completedAt: new Date().toISOString() }),
        record.id,
      ],
    );
    return { state: 'completed' };
  }

  private parseMetadata(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
  }

  async getHistory(userId: string, page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const pool = getPool();


    const [rows] = await pool.query(
      `SELECT id, prompt, video_url, result, metadata, status, created_at
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
          url: r.video_url,
          duration: meta?.duration,
          ratio: meta?.ratio,
          status: r.status,
          errorMessage: typeof r.result === 'string' ? (() => { try { return JSON.parse(r.result)?.errorMessage; } catch { return undefined; } })() : r.result?.errorMessage,
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
      `SELECT id, prompt, video_url, result, metadata, status, created_at FROM generated_content WHERE id = ? AND user_id = ?`,
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
      url: record.video_url,
      metadata: meta,
      status: record.status,
      errorMessage: resultData?.errorMessage,
      createdAt: record.created_at,
    };
  }

  async delete(id: string, userId: string) {
    const pool = getPool();
    await pool.query('DELETE FROM generated_content WHERE id = ? AND user_id = ?', [id, userId]);
    return true;
  }
}
