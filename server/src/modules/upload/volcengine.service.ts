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
      // 🔴 修复：处理文件名不包含扩展名的情况
      // 小程序端的临时文件可能不包含正确的文件名（如 file-1777264487371）
      let ext = 'png';
      if (file.originalname && file.originalname.includes('.')) {
        ext = file.originalname.split('.').pop() || 'png';
      } else if (file.mimetype) {
        // 根据MIME类型推断扩展名
        const mimeToExt: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/jpg': 'jpg',
          'image/png': 'png',
          'image/gif': 'gif',
          'image/webp': 'webp',
        };
        ext = mimeToExt[file.mimetype] || 'png';
      }

      // 🔴 按照用户提供的格式生成文件名（32位16进制字符）
      let hash = '';
      for (let i = 0; i < 8; i++) {
        hash += Math.random().toString(16).substring(2, 6);
      }
      hash = hash.substring(0, 32);
      const storeKey = `user/${hash}.${ext}`;

      this.logger.log(`[VolcengineService] StoreKey: ${storeKey}, 扩展名: ${ext}`);

      // 🔴 使用UploadImages方法上传（所有格式统一使用UploadImages）
      const uploadRes = await this.client.UploadImages({
        serviceId: this.SHORT_ID,
        fileKeys: [storeKey],
        files: [file.buffer]
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

        // 🔴 根据文件类型使用不同的URL格式
        // PNG文件：使用直接URI格式（测试可以正常访问）
        // JPG文件：使用直接URI格式（如果不行，再调整）
        // URI格式：tos-cn-i-699z2ac540/user/xxx.png 或 tos-cn-i-699z2ac540/user/xxx.jpg
        // URL格式：https://{domain}/{URI}
        // 只需要将 Uri 中的 user/ 替换为 user%2F（URL编码）
        const encodedUri = uri.replace('user/', 'user%2F');
        const directUrl = `https://${this.CUSTOM_DOMAIN}/${encodedUri}`;

        this.logger.log(`[VolcengineService] 返回的URL: ${directUrl}`);
        this.logger.log(`[VolcengineService] 原始URI: ${uri}`);

        return { url: directUrl };
      }

      throw new Error('UploadImages返回结果为空');

    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传失败:`, error);
      throw new Error(`图片上传失败: ${error.message}`);
    }
  }
}
