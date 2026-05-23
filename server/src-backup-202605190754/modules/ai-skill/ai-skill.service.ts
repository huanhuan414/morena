import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import { StorageService } from '../storage/storage.service';
import { VolcengineService } from '../upload/volcengine.service';
import * as crypto from 'crypto';

/** 技能类型 */
export type SkillType = 'palm_reading' | 'fashion_makeover';

/** 内置提示词 */
const SKILL_PROMPTS: Record<SkillType, string> = {
  palm_reading:
    '根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能',
  fashion_makeover:
    '请根据用户输入的【主题】或上传的【参考图片】，创作一张横向 4:3 的高完成度「AI服装灵感方案 / AI Fashion Inspiration Board」。\n\n【任务定位】\n这不是普通穿搭拼图，不是简单的几套衣服展示，也不是电商商品推荐图，而是一张兼具「灵感提取 + 视觉转译 + 3套完整穿搭方案 + 专业提案感 + 实际上身效果」的中文高质量服装灵感设计图。\n\n整张图的核心目标是：\n1. 清楚呈现灵感来源；\n2. 从灵感中提取色彩、气质、廓形、材质、细节与场景氛围；\n3. 将这些视觉语言转译成 3 套有逻辑的完整穿搭方案；\n4. 让用户第一眼觉得高级、时髦、专业，第二眼能看懂整套方案为什么这样设计，第三眼觉得这 3 套 look 既有审美表达，也真实可穿。',
};

const IMAGE_GEN_BASE_URL = process.env.IMAGE_GEN_API_BASE_URL || 'https://api.aaigc.top';
const IMAGE_GEN_API_KEY = process.env.IMAGE_GEN_API_KEY || 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';
const IMAGE_GEN_MODEL = process.env.IMAGE_GEN_MODEL || 'gpt-image-2-all';

@Injectable()
export class AiSkillService {
  constructor(
    private readonly storageService: StorageService,
    private readonly volcengineService: VolcengineService
  ) {}

  /**
   * 发起 AI 技能图片生成（异步，立即返回 recordId）
   */
  async startGenerate(
    userId: string,
    skillType: SkillType,
    inputImageUrl?: string,
    inputText?: string,
  ) {
    const builtInPrompt = SKILL_PROMPTS[skillType];
    if (!builtInPrompt) {
      throw new Error(`不支持的技能类型: ${skillType}`);
    }

    // 构建完整提示词
    let fullPrompt = builtInPrompt;
    if (inputText && inputText.trim()) {
      fullPrompt += `\n\n用户附加描述：${inputText.trim()}`;
    }

    // 生成记录 ID
    const recordId = `skill_${crypto.randomUUID().replace(/-/g, '').substring(0, 20)}`;

    // 写入 generating 记录
    const pool = getPool();
    await pool.query(
      `INSERT INTO ai_skill_records (id, user_id, skill_type, input_image_url, input_text, prompt, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'generating', NOW())`,
      [recordId, userId, skillType, inputImageUrl || null, inputText || null, fullPrompt],
    );

    // 异步执行生成（不 await，后台运行）
    this.doGenerate(recordId, skillType, fullPrompt, inputImageUrl).catch((err) => {
      console.error(`[AiSkillService] doGenerate unhandled error for ${recordId}:`, err.message);
    });

    return { id: recordId, skillType, status: 'generating' };
  }

  /**
   * 后台执行图片生成
   * - 有输入图片 → /v1/images/edits（multipart/form-data，参考图 + prompt）
   * - 无输入图片 → /v1/images/generations（JSON，纯文生图）
   */
  private async doGenerate(
    recordId: string,
    skillType: SkillType,
    fullPrompt: string,
    inputImageUrl?: string,
  ) {
    const pool = getPool();
    try {
      const size = skillType === 'fashion_makeover' ? '1536x1024' : '1024x1536';

      let resultImageUrl = '';

      if (inputImageUrl) {
        // 有参考图 → 用 /v1/images/edits 端点（multipart/form-data）
        console.log(`[AiSkillService] Using /v1/images/edits with reference image, skillType=${skillType}`);
        resultImageUrl = await this.callEditsApi(fullPrompt, inputImageUrl, size);
      } else {
        // 无参考图 → 用 /v1/images/generations 端点（JSON）
        console.log(`[AiSkillService] Using /v1/images/generations (text-only), skillType=${skillType}`);
        resultImageUrl = await this.callGenerationsApi(fullPrompt, size);
      }

      if (!resultImageUrl) {
        throw new Error('图片生成返回数据为空');
      }

      // 更新记录为 completed
      await pool.query(
        `UPDATE ai_skill_records SET result_image_url = ?, status = 'completed', updated_at = NOW() WHERE id = ?`,
        [resultImageUrl, recordId],
      );

      console.log(`[AiSkillService] 生成成功, recordId=${recordId}, url=${resultImageUrl.substring(0, 80)}`);
    } catch (error: any) {
      // 更新记录为 failed
      console.error(`[AiSkillService] 生成失败, recordId=${recordId}:`, error.message);
      await pool.query(
        `UPDATE ai_skill_records SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
        [error.message?.slice(0, 500) || '未知错误', recordId],
      );
    }
  }

  /**
   * 调用 /v1/images/generations（纯文生图，JSON 格式）
   */
  private async callGenerationsApi(prompt: string, size: string): Promise<string> {
    const requestBody = {
      model: IMAGE_GEN_MODEL,
      prompt,
      n: 1,
      size,
    };

    const apiUrl = `${IMAGE_GEN_BASE_URL}/v1/images/generations`;
    console.log(`[AiSkillService] POST ${apiUrl}, promptLen=${prompt.length}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${IMAGE_GEN_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`generations API error: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const result = (await response.json()) as any;
    console.log(`[AiSkillService] generations response:`, JSON.stringify(result).slice(0, 300));

    return this.extractResultImageUrl(result, 'generations');
  }

  /**
   * 调用 /v1/images/edits（参考图 + prompt，multipart/form-data）
   * 下载输入图片 → 构建 FormData → 发送请求
   */
  private async callEditsApi(prompt: string, inputImageUrl: string, size: string): Promise<string> {
    // 1. 下载输入图片
    console.log(`[AiSkillService] Downloading input image: ${inputImageUrl.substring(0, 80)}`);
    const imageResponse = await fetch(inputImageUrl);
    if (!imageResponse.ok) {
      throw new Error(`下载输入图片失败: ${imageResponse.status}`);
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : 'jpg';
    console.log(`[AiSkillService] Downloaded image: ${imageBuffer.length} bytes, type=${contentType}`);

    // 2. 构建 multipart/form-data
    const boundary = `----FormBoundary${crypto.randomBytes(16).toString('hex')}`;
    const parts: Buffer[] = [];

    // 添加 model 字段
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${IMAGE_GEN_MODEL}\r\n`
    ));

    // 添加 prompt 字段
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="prompt"\r\n\r\n${prompt}\r\n`
    ));

    // 添加 n 字段
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="n"\r\n\r\n1\r\n`
    ));

    // 添加 size 字段
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n${size}\r\n`
    ));

    // 添加 image 文件
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="input.${ext}"\r\nContent-Type: ${contentType}\r\n\r\n`
    ));
    parts.push(imageBuffer);
    parts.push(Buffer.from(`\r\n`));

    // 结束标记
    parts.push(Buffer.from(`--${boundary}--\r\n`));

    const bodyBuffer = Buffer.concat(parts);

    // 3. 发送请求
    const apiUrl = `${IMAGE_GEN_BASE_URL}/v1/images/edits`;
    console.log(`[AiSkillService] POST ${apiUrl} (multipart/form-data), imageLen=${imageBuffer.length}`);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${IMAGE_GEN_API_KEY}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: bodyBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AiSkillService] edits API error: ${response.status} ${errorText.slice(0, 300)}`);

      // 如果 edits 端点不可用，fallback 到 generations（不带图片）
      if (response.status === 404 || response.status === 405) {
        console.log(`[AiSkillService] /edits endpoint not available, falling back to /generations without image`);
        return this.callGenerationsApi(prompt, size);
      }
      throw new Error(`edits API error: ${response.status} ${errorText.slice(0, 200)}`);
    }

    const result = (await response.json()) as any;
    console.log(`[AiSkillService] edits response:`, JSON.stringify(result).slice(0, 300));

    return this.extractResultImageUrl(result, 'edits');
  }

  /**
   * 从 API 响应中提取结果图片 URL
   */
  private async extractResultImageUrl(result: any, apiName: string): Promise<string> {
    if (!result.data || !Array.isArray(result.data) || result.data.length === 0) {
      throw new Error(`${apiName}: 图片生成返回数据为空`);
    }

    const firstItem = result.data[0];

    if (firstItem.url) {
      // 下载临时URL并转存到veImageX CDN，避免第三方链接过期
      try {
        console.log(`[AiSkillService] 下载临时图片并转存veImageX CDN: ${firstItem.url.slice(0, 80)}...`)
        const imgResponse = await fetch(firstItem.url)
        if (imgResponse.ok) {
          const imgBuffer = Buffer.from(await imgResponse.arrayBuffer())
          const fileName = `ai-skill_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`
          const uploadResult = await this.volcengineService.uploadImage({ buffer: imgBuffer, originalname: fileName, mimetype: 'image/png' } as Express.Multer.File)
          console.log(`[AiSkillService] 图片转存veImageX CDN成功: ${uploadResult.url.slice(0, 80)}...`)
          return uploadResult.url
        } else {
          console.warn(`[AiSkillService] 下载临时图片失败: ${imgResponse.status}，使用原始URL`)
        }
      } catch (downloadErr: any) {
        console.warn(`[AiSkillService] 图片转存veImageX CDN失败: ${downloadErr.message}，使用原始URL`)
      }
      return firstItem.url
    }

    if (firstItem.b64_json) {
      console.log(`[AiSkillService] 收到 base64 图片，上传到 TOS`);
      const buffer = Buffer.from(firstItem.b64_json, 'base64');
      const url = await this.storageService.uploadImageFromBuffer(
        buffer,
        `ai-skill/${Date.now()}.png`,
      );
      return url;
    }

    throw new Error(`${apiName}: 未找到图片 URL 或 base64 数据`);
  }

  /**
   * 获取用户的技能生成历史
   */
  async getHistory(userId: string, skillType?: SkillType, page = 1, pageSize = 20) {
    const pool = getPool();
    const offset = (page - 1) * pageSize;

    let whereClause = 'WHERE user_id = ?';
    const params: any[] = [userId];

    if (skillType) {
      whereClause += ' AND skill_type = ?';
      params.push(skillType);
    }

    const [rows] = await pool.query(
      `SELECT id, skill_type, input_image_url, input_text, result_image_url, status, error_message, created_at
       FROM ai_skill_records ${whereClause}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset],
    );

    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM ai_skill_records ${whereClause}`,
      params,
    );

    const countData = countRows as any[];
    const total = countData[0]?.total || 0;

    return {
      list: (Array.isArray(rows) ? rows : []).map((r: any) => ({
        id: r.id,
        skillType: r.skill_type || r.skillType,
        inputImageUrl: r.input_image_url || r.inputImageUrl,
        inputText: r.input_text || r.inputText,
        resultImageUrl: r.result_image_url || r.resultImageUrl,
        status: r.status,
        errorMessage: r.error_message || r.errorMessage,
        createdAt: r.created_at || r.createdAt,
      })),
      total,
      page,
      pageSize,
    };
  }

  /**
   * 获取单条记录（轮询状态用）
   */
  async getRecord(userId: string, recordId: string) {
    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT id, skill_type, input_image_url, input_text, result_image_url, status, error_message, created_at
       FROM ai_skill_records WHERE id = ? AND user_id = ?`,
      [recordId, userId],
    );

    const recordList = rows as any[];
    if (!recordList || recordList.length === 0) {
      return null;
    }

    const r = recordList[0];
    return {
      id: r.id,
      skillType: r.skill_type || r.skillType,
      inputImageUrl: r.input_image_url || r.inputImageUrl,
      inputText: r.input_text || r.inputText,
      resultImageUrl: r.result_image_url || r.resultImageUrl,
      status: r.status,
      errorMessage: r.error_message || r.errorMessage,
      createdAt: r.created_at || r.createdAt,
    };
  }
}
