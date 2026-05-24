import { Injectable } from '@nestjs/common';
import { getPool } from '../../storage/database/mysql-client';
import { StorageService } from '../storage/storage.service';
import { VolcengineService } from '../upload/volcengine.service';
import * as crypto from 'crypto';

/** 技能类型 */
export type SkillType = 'palm_reading' | 'fashion_makeover' | 'wechat_mp_article';

/** 内置提示词 */
const SKILL_PROMPTS: Record<SkillType, string> = {
  palm_reading:
    '根据我的手掌，我想让你制作一个完整的中文掌相阅读指南，分析手掌，指南的风格应该干净而简约，细线条，圆角卡片，整体看起来非常高端。专注于掌相阅读，创建一条简单黑白轮廓图，展示我的主要掌纹，作为一件小艺术品。尽你所能',
  fashion_makeover:
    '请根据用户输入的【主题】或上传的【参考图片】，创作一张横向 4:3 的高完成度「AI服装灵感方案 / AI Fashion Inspiration Board」。\n\n【任务定位】\n这不是普通穿搭拼图，不是简单的几套衣服展示，也不是电商商品推荐图，而是一张兼具「灵感提取 + 视觉转译 + 3套完整穿搭方案 + 专业提案感 + 实际上身效果」的中文高质量服装灵感设计图。\n\n整张图的核心目标是：\n1. 清楚呈现灵感来源；\n2. 从灵感中提取色彩、气质、廓形、材质、细节与场景氛围；\n3. 将这些视觉语言转译成 3 套有逻辑的完整穿搭方案；\n4. 让用户第一眼觉得高级、时髦、专业，第二眼能看懂整套方案为什么这样设计，第三眼觉得这 3 套 look 既有审美表达，也真实可穿。',
  wechat_mp_article: '',
};

const IMAGE_GEN_BASE_URL = process.env.IMAGE_GEN_API_BASE_URL || 'https://api.aaigc.top';
const IMAGE_GEN_API_KEY = process.env.IMAGE_GEN_API_KEY || 'sk-z1CFQbVdKI6x7ciJLwQkp1vPJPp8P9lQWW0jJGQWUdkSuQsK';
const IMAGE_GEN_MODEL = process.env.IMAGE_GEN_MODEL || 'gpt-image-2';

@Injectable()
export class AiSkillService {
  constructor(
    private readonly storageService: StorageService,
    private readonly volcengineService: VolcengineService
  ) {}

  /**
   * 后台执行公众号爆款图文生成
   * 1. 用 LLM 生成文章内容
   * 2. 根据输入图片数量决定图片生成策略
   * 3. 将图片插入文章合适位置
   */
  private async doGenerateArticle(
    recordId: string,
    fullPrompt: string,
    inputImageUrl?: string,
    inputText?: string,
  ) {
    const pool = getPool();
    try {
      // Step 1: 解析输入图片（可能是多张，逗号分隔）
      const inputImageUrls: string[] = inputImageUrl ? inputImageUrl.split(',').map(u => u.trim()).filter(Boolean) : [];
      const inputCount = inputImageUrls.length;

      console.log(`[AiSkillService] 公众号爆款生成: inputCount=${inputCount}, inputText=${inputText?.substring(0, 50)}`);

      // 更新状态为 generating_text
      await pool.query(
        `UPDATE ai_skill_records SET status = 'generating_text', metadata = JSON_SET(COALESCE(metadata, '{}'), '$.progress', '正在生成爆款文章...'), updated_at = NOW() WHERE id = ?`,
        [recordId],
      );

      // Step 2: 用 LLM 生成文章（含 [IMG_N] 占位符）
      let articleContent = '';
      let articleTitle = '';
      try {
        const llmResult = await this.callLlmForArticle(inputText || '', inputCount);
        articleTitle = llmResult.title;
        articleContent = llmResult.content;
        console.log(`[AiSkillService] 文章生成成功: title=${articleTitle}, contentLen=${articleContent.length}`);

        // 文章生成成功后立即保存到 metadata，并更新状态
        await pool.query(
          `UPDATE ai_skill_records SET 
            status = 'generating_images',
            metadata = JSON_SET(COALESCE(metadata, '{}'), '$.progress', '文章生成成功，正在生成配图...', '$.articleTitle', ?, '$.articleContent', ?),
            updated_at = NOW() WHERE id = ?`,
          [articleTitle, articleContent, recordId],
        );
      } catch (err: any) {
        throw new Error(`文章生成失败: ${err.message}`);
      }

      // Step 3: 根据图片数量决定策略
      let imageUrls: string[] = [...inputImageUrls];
      let needGenerate = 0;

      if (inputCount === 0) {
        needGenerate = 3;
      } else if (inputCount < 3) {
        needGenerate = 3 - inputCount;
      }

      if (needGenerate > 0) {
        console.log(`[AiSkillService] 需要生成${needGenerate}张配图`);
        // 提取每个占位符的上下文，用于生成相关配图
        const imageContexts = this.extractImageContexts(articleContent, inputCount + needGenerate);
        // 逐张生成配图，每生成一张就保存到 metadata
        for (let i = 0; i < needGenerate; i++) {
          try {
            const imgIndex = inputCount + i + 1; // 当前图片在文章中的序号
            const context = imageContexts[imgIndex - 1] || inputText || articleTitle;
            const imagePrompt = `微信公众号文章配图，与以下内容紧密相关：${context}，风格：高端简约商务，宽幅横版，高质量插图`;
            const url = await this.callGenerationsApi(imagePrompt, '1536x1024');
            imageUrls.push(url);
            console.log(`[AiSkillService] 生成配图${i + 1}成功, prompt: ${imagePrompt.substring(0, 80)}`);

            // 每生成一张图就更新 metadata，前端可以逐步看到图片
            const currentImageUrls = imageUrls.filter(Boolean);
            await pool.query(
              `UPDATE ai_skill_records SET 
                metadata = JSON_SET(COALESCE(metadata, '{}'), '$.progress', ?, '$.images', ?),
                updated_at = NOW() WHERE id = ?`,
              [
                `配图生成中(${currentImageUrls.length}/${inputCount + needGenerate})...`,
                JSON.stringify(currentImageUrls),
                recordId,
              ],
            );
          } catch (err: any) {
            console.error(`[AiSkillService] 生成配图${i + 1}失败:`, err.message);
          }
        }
      }

      // Step 4: 将图片插入文章中的占位符位置
      // 如果文章中有 [IMG_N] 占位符，替换它们
      let processedContent = articleContent;
      for (let i = 0; i < imageUrls.length; i++) {
        const imgTag = `\n<img src="${imageUrls[i]}" style="width:100%;border-radius:8px;margin:12px 0;" />\n`;
        if (processedContent.includes(`[IMG_${i + 1}]`)) {
          processedContent = processedContent.replace(`[IMG_${i + 1}]`, imgTag);
        } else if (processedContent.includes(`[IMG]`)) {
          processedContent = processedContent.replace(`[IMG]`, imgTag);
        } else {
          // 没有占位符，在段落间插入
          const paragraphs = processedContent.split('\n\n');
          const insertPos = Math.min(Math.floor(paragraphs.length * (i + 1) / (imageUrls.length + 1)), paragraphs.length);
          paragraphs.splice(insertPos, 0, imgTag);
          processedContent = paragraphs.join('\n\n');
        }
      }

      // 清理残留占位符
      processedContent = processedContent.replace(/\[IMG_\d+\]/g, '').replace(/\[IMG\]/g, '');

      // Step 5: 保存结果
      // 对于文章类型，result_image_url 存文章内容，images 存图片URL列表
      // 扩展：用 result_image_url 存第一张图片，额外字段存文章
      const firstImage = imageUrls.length > 0 ? imageUrls[0] : '';
      await pool.query(
        `UPDATE ai_skill_records SET
          result_image_url = ?,
          input_text = ?,
          status = 'completed',
          error_message = ?,
          updated_at = NOW()
        WHERE id = ?`,
        [
          firstImage,
          JSON.stringify({ title: articleTitle, content: processedContent, images: imageUrls, inputText: inputText || '' }),
          articleTitle,
          recordId,
        ],
      );

      console.log(`[AiSkillService] 公众号爆款生成成功, recordId=${recordId}`);
    } catch (error: any) {
      console.error(`[AiSkillService] 公众号爆款生成失败, recordId=${recordId}:`, error.message);
      await pool.query(
        `UPDATE ai_skill_records SET status = 'failed', error_message = ?, updated_at = NOW() WHERE id = ?`,
        [error.message?.slice(0, 500) || '未知错误', recordId],
      );
    }
  }

  /**
   * 调用 LLM 生成公众号爆款文章
   */
  private async callLlmForArticle(userDescription: string, imageCount: number): Promise<{ title: string; content: string }> {
    const ARK_API_KEY = process.env.ARK_API_KEY || '0a6405d5-b7ae-4afa-88e3-c707ae379a47';
    const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
    const ARK_MODEL = 'doubao-seed-2-0-pro-260215';

    const imageHint = imageCount > 0
      ? `用户提供了${imageCount}张参考图片，请在文章中用 [IMG_1]${imageCount >= 2 ? ', [IMG_2]' : ''}${imageCount >= 3 ? ', [IMG_3]' : ''} 标记图片插入位置（根据上下文选择合适段落之间插入）。`
      : '请在文章中用 [IMG_1], [IMG_2], [IMG_3] 标记3张配图的插入位置（在相关段落之间分散插入）。';

    const systemPrompt = `你是一位资深的微信公众号爆款内容创作专家，擅长写出10万+阅读量的公众号文章。

要求：
1. 标题要有吸引力，使用爆款标题技巧（数字、疑问、悬念、对比等）
2. 文章结构清晰：开头引人入胜→核心观点展开→案例/数据支撑→金句总结→引导关注
3. 段落短小精悍，每段2-3句话
4. 使用金句、排比等修辞手法增强感染力
5. 适当使用emoji增加可读性
6. 结尾要有引导关注的CTA
${imageHint}

请直接返回 JSON 格式：
{"title": "文章标题", "content": "文章正文内容（Markdown格式，包含[IMG_N]占位符）"}`;

    const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ARK_API_KEY}`,
      },
      body: JSON.stringify({
        model: ARK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `请根据以下描述写一篇公众号爆款文章：\n\n${userDescription}` },
        ],
        temperature: 0.8,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`LLM API error: ${response.status} ${errText.slice(0, 200)}`);
    }

    const result = await response.json() as any;
    const text = result.choices?.[0]?.message?.content || '';

    // 尝试解析 JSON
    try {
      // 提取 JSON 部分（可能被 ```json 包裹）
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { title: parsed.title || '公众号爆款文章', content: parsed.content || '' };
      }
    } catch (e) {
      // JSON 解析失败，用整个文本作为内容
    }

    // 降级：第一行作为标题，其余作为内容
    const lines = text.split('\n').filter(Boolean);
    return { title: lines[0]?.replace(/^#+\s*/, '') || '公众号爆款文章', content: lines.slice(1).join('\n\n') || text };
  }

  /**
   * 提取文章中每个 [IMG_N] 占位符的上下文，用于生成相关配图
   */
  private extractImageContexts(content: string, totalImages: number): string[] {
    const contexts: string[] = [];
    for (let i = 1; i <= totalImages; i++) {
      const placeholder = `[IMG_${i}]`;
      const idx = content.indexOf(placeholder);
      if (idx === -1) {
        contexts.push('');
        continue;
      }
      // 取占位符前200字和后200字作为上下文
      const before = content.substring(Math.max(0, idx - 200), idx).trim();
      const after = content.substring(idx + placeholder.length, Math.min(content.length, idx + placeholder.length + 200)).trim();
      // 提取最近的段落文字（按换行分割，取最后1-2段）
      const beforeParagraphs = before.split(/\n+/).filter(Boolean);
      const afterParagraphs = after.split(/\n+/).filter(Boolean);
      const contextParts = [
        beforeParagraphs.slice(-1).join(' ').slice(-100),
        afterParagraphs.slice(0, 1).join(' ').slice(0, 100),
      ].filter(Boolean);
      contexts.push(contextParts.join('，') || '');
    }
    return contexts;
  }

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
    if (!builtInPrompt && skillType !== 'wechat_mp_article') {
      throw new Error(`不支持的技能类型: ${skillType}`);
    }

    // 公众号爆款生成需要输入文本
    if (skillType === 'wechat_mp_article' && (!inputText || !inputText.trim())) {
      throw new Error('请输入文章描述');
    }

    // 构建完整提示词
    let fullPrompt = builtInPrompt || '';
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
    if (skillType === 'wechat_mp_article') {
      this.doGenerateArticle(recordId, fullPrompt, inputImageUrl, inputText).catch((err) => {
        console.error(`[AiSkillService] doGenerateArticle unhandled error for ${recordId}:`, err.message);
      });
    } else {
      this.doGenerate(recordId, skillType, fullPrompt, inputImageUrl).catch((err) => {
        console.error(`[AiSkillService] doGenerate unhandled error for ${recordId}:`, err.message);
      });
    }

    return { id: recordId, skillType, status: 'generating' };
  }

  /**
   * 检查技能每日使用次数限制
   * 未订阅用户：1次/天/技能
   * 订阅用户：3次/天/技能
   */
  async checkDailyLimit(userId: string, skillType: string): Promise<{ used: number; limit: number; remaining: number; isSubscribed: boolean }> {
    const isSubscribed = await this.isUserSubscribed(userId)
    const limit = isSubscribed ? 3 : 1

    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT COUNT(*) as cnt FROM ai_skill_records WHERE user_id = ? AND skill_type = ? AND created_at >= ? AND created_at < ?`,
      [userId, skillType, startOfDay, endOfDay]
    )

    const used = Number(rows[0]?.cnt || 0)
    const remaining = Math.max(0, limit - used)

    return { used, limit, remaining, isSubscribed }
  }

  /**
   * 批量查询所有技能每日使用次数
   */
  async getAllUsageLimits(userId: string): Promise<Record<string, { used: number; limit: number; remaining: number; isSubscribed: boolean }>> {
    const isSubscribed = await this.isUserSubscribed(userId)
    const limit = isSubscribed ? 3 : 1

    const today = new Date()
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate())
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)

    const pool = getPool();
    const [rows] = await pool.query(
      `SELECT skill_type, COUNT(*) as cnt FROM ai_skill_records WHERE user_id = ? AND created_at >= ? AND created_at < ? GROUP BY skill_type`,
      [userId, startOfDay, endOfDay]
    )

    const usageMap: Record<string, number> = {}
    for (const row of rows as any[]) {
      usageMap[row.skill_type] = Number(row.cnt)
    }

    // 技能ID → 对应的skill_type映射（数据库skills.id → ai_skill_records.skill_type）
    // 多个skill_type可以映射到同一个技能ID（如content_writing关联wechat_mp_article和content_writing两种记录）
    const skillIdToTypes: Record<string, string[]> = {
      palm_reading: ['palm_reading'],
      fashion_advice: ['fashion_makeover'],
      content_writing: ['wechat_mp_article', 'content_writing'],
      image_gen: ['image_gen'],
      video_gen: ['video_gen'],
    }

    const result: Record<string, { used: number; limit: number; remaining: number; isSubscribed: boolean }> = {}
    for (const [skillId, types] of Object.entries(skillIdToTypes)) {
      const used = types.reduce((sum, t) => sum + (usageMap[t] || 0), 0)
      result[skillId] = { used, limit, remaining: Math.max(0, limit - used), isSubscribed }
    }

    return result
  }

  /**
   * 检查用户是否订阅
   */
  private async isUserSubscribed(userId: string): Promise<boolean> {
    try {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT subscription_status FROM user_subscriptions WHERE user_id = ? AND status = 'active' ORDER BY created_at DESC LIMIT 1`,
        [userId]
      )
      const resultRows = (rows as any[])
      return resultRows.length > 0 && resultRows[0].subscription_status === 'active'
    } catch {
      // 表不存在或查询失败，默认未订阅
      return false
    }
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
      console.log(`[AiSkillService] 收到 base64 图片，上传到 veImageX CDN`);
      try {
        const buffer = Buffer.from(firstItem.b64_json, 'base64');
        const fileName = `ai-skill_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.png`;
        const uploadResult = await this.volcengineService.uploadImage({ buffer, originalname: fileName, mimetype: 'image/png' } as Express.Multer.File);
        console.log(`[AiSkillService] base64 图片转存 veImageX CDN 成功: ${uploadResult.url.slice(0, 80)}...`);
        return uploadResult.url;
      } catch (volcErr: any) {
        console.warn(`[AiSkillService] veImageX 上传失败: ${volcErr.message}，降级到对象存储`);
        const buffer = Buffer.from(firstItem.b64_json, 'base64');
        const url = await this.storageService.uploadImageFromBuffer(
          buffer,
          `ai-skill/${Date.now()}.png`,
        );
        return url;
      }
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
      `SELECT id, skill_type, input_image_url, input_text, result_image_url, status, error_message, created_at, metadata
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
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || null),
        // 公众号文章类型，解析 article 数据
        article: r.skill_type === 'wechat_mp_article' && r.input_text ? this.parseArticleData(r.input_text) : null,
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
      `SELECT id, skill_type, input_image_url, input_text, result_image_url, status, error_message, created_at, metadata
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
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : (r.metadata || null),
      article: r.skill_type === 'wechat_mp_article' && r.input_text ? this.parseArticleData(r.input_text) : null,
    };
  }

  /**
   * 解析文章数据（从 input_text 字段中提取 JSON）
   */
  private parseArticleData(rawInputText: string): { title: string; content: string; images: string[]; inputText: string } | null {
    try {
      // input_text 在完成时被存为 JSON 字符串
      if (rawInputText.startsWith('{')) {
        return JSON.parse(rawInputText);
      }
    } catch (e) {
      // 解析失败返回 null
    }
    return null;
  }

  /**
   * 删除单条记录
   */
  async deleteRecord(userId: string, recordId: string) {
    const pool = getPool();
    const [result] = await pool.query(
      `DELETE FROM ai_skill_records WHERE id = ? AND user_id = ?`,
      [recordId, userId],
    );
    const affected = (result as any).affectedRows || 0;
    if (affected === 0) {
      throw new Error('记录不存在或无权删除');
    }
    return { success: true };
  }

  /**
   * 批量删除记录
   */
  async deleteRecords(userId: string, recordIds: string[]) {
    if (!recordIds || recordIds.length === 0) return { success: true, deleted: 0 };
    const pool = getPool();
    const placeholders = recordIds.map(() => '?').join(',');
    const [result] = await pool.query(
      `DELETE FROM ai_skill_records WHERE id IN (${placeholders}) AND user_id = ?`,
      [...recordIds, userId],
    );
    const affected = (result as any).affectedRows || 0;
    return { success: true, deleted: affected };
  }
}
