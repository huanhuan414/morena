import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import { StorageService } from '../storage/storage.service';
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
  constructor(private readonly storageService: StorageService) {}

  /**
   * 生成 AI 技能图片
   */
  async generate(
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

    // 写入 pending 记录
    const pool = getPool();
    await pool.query(
      `INSERT INTO ai_skill_records (id, user_id, skill_type, input_image_url, input_text, prompt, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'generating', NOW())`,
      [recordId, userId, skillType, inputImageUrl || null, inputText || null, fullPrompt],
    );

    try {
      // 构建请求体
      const requestBody: any = {
        model: IMAGE_GEN_MODEL,
        prompt: fullPrompt,
        n: 1,
        size: skillType === 'fashion_makeover' ? '1536x1024' : '1024x1536',
      };

      // 如果有输入图片，作为 image 引用传入
      if (inputImageUrl) {
        requestBody.image_url = inputImageUrl;
      }

      console.log(`[AiSkillService] calling API, skillType=${skillType}, hasImage=${!!inputImageUrl}`);

      const apiUrl = `${IMAGE_GEN_BASE_URL}/v1/images/generations`;
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
        console.error(`[AiSkillService] API error: ${response.status} ${errorText}`);
        throw new Error(`图片生成API错误: ${response.status}`);
      }

      const result = (await response.json()) as any;
      console.log(`[AiSkillService] API response:`, JSON.stringify(result).slice(0, 200));

      // 解析结果图片 URL
      let resultImageUrl = '';
      if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        const firstItem = result.data[0];
        if (firstItem.url) {
          resultImageUrl = firstItem.url;
        } else if (firstItem.b64_json) {
          // base64 图片上传到 TOS
          console.log('[AiSkillService] 收到 base64 图片，上传到 TOS');
          const buffer = Buffer.from(firstItem.b64_json, 'base64');
          resultImageUrl = await this.storageService.uploadImageFromBuffer(
            buffer,
            `ai-skill/${skillType}/${recordId}.png`,
          );
        }
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

      return {
        id: recordId,
        skillType,
        resultImageUrl,
        status: 'completed',
      };
    } catch (error: any) {
      // 更新记录为 failed
      await pool.query(
        `UPDATE ai_skill_records SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
        [error.message, recordId],
      );
      throw error;
    }
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
   * 获取单条记录
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
