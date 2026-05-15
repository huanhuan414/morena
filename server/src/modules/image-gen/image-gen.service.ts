import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import axios from 'axios';
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
  private readonly cozeApiBaseUrl = process.env.COZE_API_BASE_URL || 'https://api.coze.cn';
  private readonly cozeApiKey = process.env.COZE_WORKLOAD_IDENTITY_API_KEY || '';

  constructor() {}

  /**
   * 用豆包大模型将用户描述转为专业文生图提示词
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

    const systemPrompt = `You are an expert AI image prompt engineer. Your task is to transform simple user descriptions into professional, high-quality image generation prompts.

Rules:
1. Preserve the user's original intent and core elements
2. Add detailed visual details: lighting, composition, color palette, atmosphere, texture
3. Add quality-enhancing terms: masterpiece, best quality, highly detailed, professional
4. Output in English only (image models understand English better)
5. Keep the prompt under 80 words
6. The style MUST be: ${styleName}
7. Output ONLY the prompt text, no explanations or extra text`;

    try {
      // 直接用Coze OpenAPI调用豆包大模型
      console.log('[ImageGenService] 调用豆包大模型优化提示词...');

      const token = await this.getCozeToken();
      if (!token) {
        throw new Error('获取Coze token失败');
      }

      const response = await axios.post(
        `${this.cozeApiBaseUrl}/v3/chat`,
        {
          bot_id: 'default',
          user_id: 'image-gen-service',
          stream: false,
          auto_save_history: false,
          additional_messages: [
            { role: 'system', content: systemPrompt, content_type: 'text' },
            { role: 'user', content: `Transform this description into a professional image generation prompt:\n\n"${userPrompt}"`, content_type: 'text' },
          ],
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      // 从Coze API响应中提取内容
      const messages = response.data?.messages || [];
      const answerMsg = messages.find((m: any) => m.role === 'assistant' && m.type === 'answer');
      const enhanced = answerMsg?.content?.trim();

      if (enhanced && enhanced.length > 10) {
        console.log(`[ImageGenService] 提示词优化: "${userPrompt}" -> "${enhanced.slice(0, 80)}..."`);
        return enhanced;
      }
    } catch (err: any) {
      console.warn('[ImageGenService] 豆包提示词优化失败，使用本地增强:', err.message);
    }

    // fallback: 本地简单增强
    return this.buildLocalEnhancedPrompt(userPrompt, style);
  }

  /**
   * 获取Coze API Token（使用Workload Identity）
   */
  private async getCozeToken(): Promise<string> {
    const clientId = process.env.COZE_WORKLOAD_IDENTITY_CLIENT_ID;
    const clientSecret = process.env.COZE_WORKLOAD_IDENTITY_CLIENT_SECRET;
    const tokenEndpoint = process.env.COZE_WORKLOAD_IDENTITY_TOKEN_ENDPOINT;

    if (!clientId || !clientSecret || !tokenEndpoint) {
      console.warn('[ImageGenService] 缺少COZE环境变量');
      return '';
    }

    try {
      const response = await axios.post(
        tokenEndpoint,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10000,
        },
      );
      return response.data?.access_token || '';
    } catch (err: any) {
      console.error('[ImageGenService] 获取Coze token失败:', err.message);
      return '';
    }
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
