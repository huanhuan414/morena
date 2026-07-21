import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { getPool } from '../../storage/database/mysql-client';
import { ImageGenService } from '../image-gen/image-gen.service';
import { VideoGenService } from '../video-gen/video-gen.service';
import { CoinService } from '../coin/coin.service';

interface QueueRecord {
  id: string;
  user_id: string;
  content_type: 'image' | 'video';
  prompt: string;
  task_id?: string | null;
  metadata?: any;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class GenerationQueueService implements OnModuleInit {
  private readonly logger = new Logger(GenerationQueueService.name);
  private readonly imageConcurrency = 5;
  private readonly videoConcurrency = 5;
  private tickRunning = false;

  constructor(
    private readonly imageGenService: ImageGenService,
    private readonly videoGenService: VideoGenService,
    private readonly coinService: CoinService,
  ) {}

  onModuleInit() {
    void this.runQueue();
  }
  
  /**
   * 每5秒调度一次队列任务
   */
  @Interval(5000)
  async runQueue() {
    if (this.tickRunning) return;
    this.tickRunning = true;
    try {
      await this.expireStaleTasks();
      await this.pollGeneratingVideos();

      // const [imageTasks, videoTasks] = await Promise.all([
      //   this.claimPendingTasks('image', this.imageConcurrency),
      //   this.claimPendingTasks('video', this.videoConcurrency),
      // ]);
      const imageTasks = await this.claimPendingTasks(
        'image',
        this.imageConcurrency,
      );

      const videoTasks = await this.claimPendingTasks(
        'video',
        this.videoConcurrency,
      );

      for (const task of imageTasks) {
        void this.processImageTask(task);
      }
      for (const task of videoTasks) {
        void this.startVideoTask(task);
      }
    } catch (error: any) {
      this.logger.error(`队列调度失败: ${error?.message || error}`);
    } finally {
      this.tickRunning = false;
    }
  }

  private async claimPendingTasks(contentType: 'image' | 'video', maxConcurrency: number): Promise<QueueRecord[]> {
    const pool = getPool();
    const connection = await pool.getConnection();
    const lockName = `generation_queue_claim_${contentType}`;
    let lockAcquired = false;
    try {
      const [lockRows] = await connection.query('SELECT GET_LOCK(?, 1) AS acquired', [lockName]);
      lockAcquired = Number((lockRows as any[])?.[0]?.acquired || 0) === 1;
      if (!lockAcquired) return [];

      await connection.beginTransaction();
      const [countRows] = await connection.query(
        `SELECT COUNT(*) AS total FROM generated_content WHERE content_type = ? AND status = 'generating'`,
        [contentType],
      );
      const activeCount = Number((countRows as any[])?.[0]?.total || 0);
      const available = Math.max(0, maxConcurrency - activeCount);
      if (available === 0) {
        await connection.commit();
        return [];
      }

      const [rows] = await connection.query(
        `SELECT id, user_id, content_type, prompt, task_id, metadata, created_at, updated_at
         FROM generated_content
         WHERE content_type = ? AND status = 'pending'
         ORDER BY created_at ASC
         LIMIT ${available}
         FOR UPDATE`,
        [contentType],
      );
      const tasks = (rows as QueueRecord[]) || [];
      const claimed: QueueRecord[] = [];
      for (const task of tasks) {
        const metadata = this.parseMetadata(task.metadata);
        const [updateResult] = await connection.query(
          `UPDATE generated_content
           SET status = 'generating', metadata = ?, updated_at = NOW()
           WHERE id = ? AND status = 'pending'`,
          [JSON.stringify({ ...metadata, startedAt: new Date().toISOString() }), task.id],
        );
        if (Number((updateResult as any)?.affectedRows || 0) === 1) {
          claimed.push({ ...task, metadata: { ...metadata, startedAt: new Date().toISOString() } });
        }
      }
      await connection.commit();
      return claimed;
    } catch (error) {
      try { await connection.rollback(); } catch {}
      throw error;
    } finally {
      if (lockAcquired) {
        try { await connection.query('SELECT RELEASE_LOCK(?)', [lockName]); } catch {}
      }
      connection.release();
    }
  }

  private async processImageTask(task: QueueRecord) {
    const metadata = this.parseMetadata(task.metadata);
    const delays = [0, 5000, 15000]; // 重试延迟时间，单位毫秒5s、15s
    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      if (delays[attempt - 1] > 0) await this.delay(delays[attempt - 1]);
      await this.updateAttempts(task.id, metadata, attempt, lastError?.message);
      try {
        await this.imageGenService.generate({
          userId: task.user_id,
          prompt: task.prompt,
          style: metadata.style || 'realistic',
          size: metadata.size || '1024x1536',
          recordId: task.id,
          coinConsumed: Number(metadata.coinConsumed || 0),
          attempts: attempt,
        });
        return;
      } catch (error: any) {
        lastError = error;
        this.logger.warn(`图片任务失败: id=${task.id}, attempt=${attempt}/3, error=${error?.message}`);
        if (!this.isRetryableImageError(error) || attempt === 3) break;
      }
    }

    await this.failTask(task, this.normalizeImageError(lastError));
  }

  private async startVideoTask(task: QueueRecord) {
    try {
      await this.videoGenService.createQueuedTask(task);
    } catch (error: any) {
      await this.failTask(task, error?.message || '视频生成任务创建失败');
    }
  }

  private async pollGeneratingVideos() {
    const pool = getPool();
    const connection = await pool.getConnection();
    let lockAcquired = false;
    try {
      const [lockRows] = await connection.query('SELECT GET_LOCK(?, 1) AS acquired', ['generation_queue_video_poll']);
      lockAcquired = Number((lockRows as any[])?.[0]?.acquired || 0) === 1;
      if (!lockAcquired) return;

      const [rows] = await pool.query(
        `SELECT id, user_id, content_type, prompt, task_id, metadata, created_at, updated_at
         FROM generated_content
         WHERE content_type = 'video' AND status = 'generating' AND task_id IS NOT NULL
         ORDER BY updated_at ASC
         LIMIT ?`,
        [this.videoConcurrency],
      );
      for (const task of (rows as QueueRecord[]) || []) {
        try {
          const result = await this.videoGenService.pollQueuedTask(task);
          if (result.state === 'failed') {
            await this.failTask(task, result.errorMessage || '视频生成失败');
          }
        } catch (error: any) {
          this.logger.warn(`查询视频任务失败，保留 generating 等待下次查询: id=${task.id}, error=${error?.message}`);
        }
      }
    } finally {
      if (lockAcquired) {
        try { await connection.query('SELECT RELEASE_LOCK(?)', ['generation_queue_video_poll']); } catch {}
      }
      connection.release();
    }
  }

  private async expireStaleTasks() {
    const pool = getPool();
    // (content_type = 'video' AND task_id IS NULL AND updated_at < DATE_SUB(NOW(), INTERVAL 30 MINUTE)) OR
    const [rows] = await pool.query(
      `SELECT id, user_id, content_type, prompt, task_id, metadata, created_at, updated_at
       FROM generated_content
       WHERE status = 'generating' AND (
         (content_type = 'image' AND updated_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)) OR
         (content_type = 'video' AND updated_at < DATE_SUB(NOW(), INTERVAL 2 HOUR))
       )`,
    );
    for (const task of (rows as QueueRecord[]) || []) {
      const message = task.content_type === 'image'
        ? '图片生成任务已超时'
        : '视频生成任务已超时';
      await this.failTask(task, message);
    }
  }

  private async failTask(task: QueueRecord, errorMessage: string) {
    const pool = getPool();
    const [metadataRows] = await pool.query(
      'SELECT metadata FROM generated_content WHERE id = ? LIMIT 1',
      [task.id],
    );
    const metadata = this.parseMetadata((metadataRows as any[])?.[0]?.metadata || task.metadata);
    const [result] = await pool.query(
      `UPDATE generated_content
       SET status = 'failed', result = ?, metadata = ?, updated_at = NOW()
       WHERE id = ? AND status = 'generating'`,
      [
        JSON.stringify({ errorMessage }),
        JSON.stringify({ ...metadata, lastError: errorMessage, failedAt: new Date().toISOString() }),
        task.id,
      ],
    );
    if (Number((result as any)?.affectedRows || 0) !== 1) return;

    const amount = Number(metadata.coinConsumed || 0);
    if (amount <= 0) return;
    try {
      await this.coinService.gift(
        task.user_id,
        amount,
        `${task.content_type === 'image' ? '图片生成' : '视频生成'}失败退款`,
      );
    } catch (error: any) {
      this.logger.error(`生成任务退款失败: id=${task.id}, amount=${amount}, error=${error?.message}`);
    }
  }

  private async updateAttempts(taskId: string, metadata: Record<string, any>, attempts: number, lastError?: string) {
    const pool = getPool();
    await pool.query(
      `UPDATE generated_content SET metadata = ?, updated_at = NOW() WHERE id = ? AND status = 'generating'`,
      [JSON.stringify({ ...metadata, attempts, maxAttempts: 3, lastError }), taskId],
    );
  }

  private isRetryableImageError(error: any): boolean {
    const message = String(error?.message || '');
    return error?.name === 'TimeoutError'
      || error?.name === 'AbortError'
      || message.includes('fetch failed')
      || /API错误:\s*(429|5\d\d)/.test(message)
      || /ECONN|ETIMEDOUT|socket|network/i.test(message);
  }

  private normalizeImageError(error: any): string {
    const message = String(error?.message || '');
    if (message.includes('fetch failed') || error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      return '图片生成服务暂时不可用，请稍后重试';
    }
    return message || '图片生成失败';
  }

  private parseMetadata(value: any): Record<string, any> {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
  }

  private delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}