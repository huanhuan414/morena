import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import { LLMClient, Config, Message } from 'coze-coding-dev-sdk';
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
  enhancedPrompt: string;
  style: string;
  size: string;
  createdAt: string;
}

@Injectable()
export class ImageGenService {
  private readonly baseUrl = process.env.IMAGE_GEN_API_BASE_URL || 'https://api.aaigc.top';
  private readonly apiKey = process.env.IMAGE_GEN_API_KEY || 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';
  private readonly model = process.env.IMAGE_GEN_MODEL || 'gpt-image-2-all';
  private readonly llmClient: LLMClient;

  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }

  /**
   * 用豆包大模型将用户描述转为专业文生图提示词
   * 核心逻辑：
   * 1. 分析用户意图（情感、场景、叙事）
   * 2. 将意图转化为英文专业视觉描述
   * 3. 融入指定风格
   * 4. 输出纯英文高质量prompt
   */
  private async enhancePromptWithLLM(userPrompt: string, style: string): Promise<string> {
    const styleMap: Record<string, string> = {
      realistic: 'photorealistic photography',
      anime: 'Japanese anime illustration',
      oil_painting: 'classical oil painting',
      watercolor: 'watercolor painting',
      sketch: 'pencil sketch drawing',
      '3d': '3D rendered artwork',
      cyberpunk: 'cyberpunk sci-fi',
      chinese: 'Chinese ink wash painting',
    };
    const styleName = styleMap[style] || 'photorealistic photography';

    const systemPrompt = `你是一位世界顶级的AI图像提示词工程师。你的任务是将用户的简单描述转化为专业、生动、极具画面感的英文文生图提示词。

## 你的工作流程：
1. **意图分析**：深入理解用户真正想要表达什么——情绪、主题、场景、故事性
2. **视觉扩展**：用具体的视觉元素丰富画面——光线方向与质感、色彩搭配、构图法则、相机角度、景深效果、材质纹理
3. **风格融合**：将"${styleName}"风格无缝融入描述中——不是作为标签附加，而是融入视觉叙事本身
4. **品质提升**：自然地加入品质词汇——masterpiece, ultra detailed, professional, 8K
5. **最终输出**：输出一段连贯的英文描述，像一个完整的画面

## 严格规则：
- 只输出最终的英文提示词，不要输出任何中文、解释、标签
- 提示词必须是自然流畅的英文描述（不是逗号分隔的标签堆砌）
- 字数控制在50-120词
- 必须全部使用英文（图片生成模型对英文理解远好于中文）
- 不要简单追加风格关键词——风格必须是描述的有机组成部分
- 思考什么让这幅画面在视觉上令人震撼，然后描述它`;

    try {
      console.log('[ImageGenService] 调用豆包大模型分析意图并优化提示词...');

      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];

      const response = await this.llmClient.invoke(messages, {
        model: 'doubao-seed-2-0-lite-260215',
        temperature: 0.8,
      });

      const enhanced = response.content?.trim();

      if (enhanced && enhanced.length > 10) {
        console.log(`[ImageGenService] 豆包完整输出: "${enhanced}"`);
        return enhanced;
      }

      console.warn('[ImageGenService] 豆包返回内容过短，使用本地增强');
    } catch (err: any) {
      console.warn('[ImageGenService] 豆包提示词优化失败，使用本地增强:', err.message);
    }

    // fallback: 本地简单增强
    return this.buildLocalEnhancedPrompt(userPrompt, style);
  }

  /**
   * 本地提示词增强（fallback）
   */
  private buildLocalEnhancedPrompt(prompt: string, style: string): string {
    const styleEnhancements: Record<string, string> = {
      realistic: 'photorealistic, high detail, professional photography, 8k resolution, natural lighting',
      anime: 'anime style, vibrant colors, clean lines, Japanese animation aesthetic, detailed illustration',
      oil_painting: 'oil painting style, rich textures, classical art, masterpiece, dramatic lighting',
      watercolor: 'watercolor painting, soft colors, artistic, dreamy atmosphere, flowing paint',
      sketch: 'pencil sketch, detailed linework, artistic drawing, monochrome, fine details',
      '3d': '3D render, realistic lighting, detailed textures, high quality, octane render',
      cyberpunk: 'cyberpunk style, neon lights, futuristic, dark atmosphere, sci-fi',
      chinese: 'Chinese ink wash painting, traditional art, elegant, flowing brush strokes',
    };
    const enhancement = styleEnhancements[style] || styleEnhancements.realistic;
    return `${prompt}, ${enhancement}, high quality, detailed, beautiful composition`;
  }

  /**
   * 生成图片 - 先用豆包优化提示词，再调用图片生成API
   */
  async generate(params: ImageGenParams): Promise<ImageGenResult> {
    const { userId, prompt, style = 'realistic', size = '1024x1536', n = 1 } = params;

    console.log(`[ImageGenService] generate: userId=${userId}, prompt="${prompt.slice(0, 50)}", style=${style}, size=${size}`);

    // Step 1: 用豆包大模型优化提示词
    const enhancedPrompt = await this.enhancePromptWithLLM(prompt, style);

    // Step 2: 调用图片生成 API
    const apiUrl = `${this.baseUrl}/v1/images/generations`;
    console.log(`[ImageGenService] calling API: ${apiUrl}, model: ${this.model}, enhancedPrompt: "${enhancedPrompt.slice(0, 80)}..."`);

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

    // Step 3: 保存记录到数据库
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
          JSON.stringify({ url: imageUrl, style, size, model: this.model, enhancedPrompt }),
          imageUrl,
          'completed',
          JSON.stringify({ style, size, enhancedPrompt, originalPrompt: prompt, model: this.model, apiResponse: { created: result.created } }),
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
      enhancedPrompt,
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
          enhancedPrompt: meta?.enhancedPrompt || meta?.originalPrompt,
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
      enhancedPrompt: meta?.enhancedPrompt,
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
