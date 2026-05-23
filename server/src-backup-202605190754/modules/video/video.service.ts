import { Injectable } from '@nestjs/common';
import { VideoGenerationClient, Config } from 'coze-coding-dev-sdk';

@Injectable()
export class VideoService {
  /**
   * 生成莫瑞娜推广视频
   */
  async generateMorinaPromoVideo(
    duration: number,
    ratio: string,
    headers: Record<string, string>
  ) {
    try {
      // 初始化视频生成客户端（不传递customHeaders，避免类型错误）
      const config = new Config();
      const client = new VideoGenerationClient(config);

      // 设计详细的7秒视频剧本
      const prompt = `
【莫瑞娜人机公众台推广视频 - 7秒竖屏】

[0-1秒 - 悬念开场]
画面：纯黑背景，突然从屏幕中心炸开一道耀眼的紫色光芒，一双发光的蓝色眼睛在光幕中缓缓睁开，注视着观众。眼睛周围环绕着流动的蓝色光纹，充满神秘感和科技感。

[1-3秒 - 分身诞生]
画面：镜头缓慢拉远，从眼睛的特写扩展到全身。一个优雅的女性AI分身从光幕中诞生，逐渐显现完整的身体。她身着未来感的科技服装，皮肤上流淌着微弱的蓝色光纹，长发飘逸，表情从迷茫逐渐转为自信和微笑。背景是未来城市的天际线，霓虹灯光闪烁，高楼大厦充满未来感。

[3-5秒 - 多样性展示]
画面：主分身的周围逐渐浮现出多个不同风格的分身形象，包括：一个二次元风格的动漫少女，一个赛博朋克风格的机械战士，一个卡通风格的可爱角色，一个优雅风格的成熟女性。所有分身相视一笑，展现和谐共处的氛围。背景光线更加明亮，充满了希望和多样性。

[5-7秒 - 品牌露出]
画面：所有分身渐渐融合成一个发光的光球，光球中心炸开，金色光芒向四周绽放。在光芒中，"莫瑞娜"三个字由光粒子流动组成，逐渐凝聚成型。屏幕底部出现"莫瑞娜人机公众台"的logo，以及品牌标语"每个人都可以拥有专属AI分身"。整个画面充满温暖和希望的氛围。

【视觉风格】
- 色调：紫色、蓝色、金色的科技感配色
- 光效：霓虹光效、流动光纹、爆炸光芒
- 节奏：慢开（神秘）→加速（展示）→爆发（高潮）
- 画质：720p高清晰度
- 情感：神秘→震撼→亲切→温暖
      `;

      // 调用视频生成API
      const content = [
        {
          type: 'text' as const,
          text: prompt,
        },
      ];

      const response = await client.videoGeneration(content, {
        model: 'doubao-seedance-1-5-pro-251215',
        duration: duration,
        ratio: ratio as '9:16' | '16:9' | '1:1',
        resolution: '720p',
        watermark: false,
        generateAudio: true,
      });

      console.log('[VideoService] 莫瑞娜推广视频生成成功:', {
        videoUrl: response.videoUrl,
        taskId: response.response?.id,
      });

      return {
        success: true,
        videoUrl: response.videoUrl,
        taskId: response.response?.id,
        duration: duration,
        ratio: ratio,
        resolution: '720p',
      };
    } catch (error) {
      console.error('[VideoService] 视频生成失败:', error);
      throw new Error('Video generation failed: ' + error.message);
    }
  }
}
