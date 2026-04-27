import { Injectable, Logger } from '@nestjs/common';
import { ImageXClient } from '@volcengine/imagex-openapi';

/**
 * Volcengine veImageX 图片上传服务
 * 
 * 正确的服务ID格式: tos-cn-i-{短ID}
 * 例如: tos-cn-i-699z2ac540
 * 
 * 图片访问URL格式:
 * - 自定义域名: https://{domain}/{serviceId}/user%2F{文件名}~tplv-{短ID}-image.png
 * - 默认域名: https://{serviceId}.cn-beijing.imagex.volces.com/{URI}
 */
@Injectable()
export class VolcengineService {
  private readonly logger = new Logger(VolcengineService.name);
  private client: ImageXClient;

  // 完整的服务ID
  private readonly FULL_SERVICE_ID = 'tos-cn-i-699z2ac540';
  // 短ID（用于模板参数）
  private readonly SHORT_ID = '699z2ac540';
  // 自定义域名
  // 🔴 使用自定义域名
  private readonly CUSTOM_DOMAIN = 'voic.51webjs.com';

  constructor() {
    this.client = new ImageXClient({
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      region: 'cn-north-1',
      host: 'imagex.volcengineapi.com',
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[VolcengineService] 开始上传图片: ${file.originalname}, MIME: ${file.mimetype}`);

    try {
      // 🔴 尝试使用UploadImages方法（简化的上传方法）
      const fileBuffer = file.buffer;

      // 🔴 按照用户提供的格式生成文件名
      const ext = file.originalname.split('.').pop() || 'png';
      let hash = '';
      for (let i = 0; i < 8; i++) {
        hash += Math.random().toString(16).substring(2, 6);
      }
      hash = hash.substring(0, 32);
      const storeKey = `user/${hash}.${ext}`;

      this.logger.log(`[VolcengineService] StoreKey: ${storeKey}`);

      // 🔴 使用UploadImages方法上传
      const uploadRes = await this.client.UploadImages({
        serviceId: this.SHORT_ID,
        fileKeys: [storeKey],
        files: [fileBuffer]
      });

      this.logger.log(`[VolcengineService] UploadImages响应:`, JSON.stringify(uploadRes, null, 2));

      // 🔴 获取返回的URI并构建URL
      if (uploadRes.Result && uploadRes.Result.Results && uploadRes.Result.Results.length > 0) {
        const result = uploadRes.Result.Results[0] as any;
        const uri = result.Uri;

        if (!uri) {
          throw new Error('UploadImages返回的URI为空');
        }

        this.logger.log(`[VolcengineService] 原始URI: ${uri}`);

        // 🔴 尝试两种URL格式
        const urlsToTry: { name: string; url: string }[] = [];

        // 1. 直接URI格式（不带.mf和模板参数）
        const directUrl = `https://${this.CUSTOM_DOMAIN}/${uri.replace('user/', 'user%2F')}`;
        urlsToTry.push({ name: '直接URI', url: directUrl });

        // 2. 用户提供的格式（带.mf和模板参数）
        const encodedUri = uri.replace('user/', 'user%2F').replace('.png', '.mf');
        const templateUrl = `https://${this.CUSTOM_DOMAIN}/${encodedUri}~tplv-${this.SHORT_ID}-image.${ext}`;
        urlsToTry.push({ name: '模板URL', url: templateUrl });

        this.logger.log(`[VolcengineService] 尝试的URL列表:`, JSON.stringify(urlsToTry, null, 2));

        // 🔴 先返回直接URI格式，看看是否可以访问
        return { url: urlsToTry[0].url };
      }

      throw new Error('UploadImages返回结果为空');

    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传失败:`, error);
      throw new Error(`图片上传失败: ${error.message}`);
    }
  }
}
