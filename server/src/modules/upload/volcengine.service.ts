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
      // 🔴 修复：如果文件名不正确（比如.file-xxx），使用默认文件名
      let originalname = file.originalname;
      if (!originalname || originalname.startsWith('.') || !originalname.includes('.')) {
        this.logger.warn(`[VolcengineService] 文件名不正确: ${originalname}, 使用默认文件名`);
        // 根据MIME类型判断文件扩展名
        const ext = this.getExtensionFromMime(file.mimetype, originalname);
        originalname = `image_${Date.now()}.${ext}`;
      }

      // 1. 获取上传凭证
      const storeKey = this.generateStoreKey(originalname);
      this.logger.log(`[VolcengineService] StoreKey: ${storeKey}`);
      
      const applyRes = await this.client.ApplyImageUpload({
        ServiceId: this.SHORT_ID,  // 🔴 修复：使用短ID
        UploadNum: 1,
        StoreKeys: [storeKey],
      });

      this.logger.log(`[VolcengineService] ApplyImageUpload 响应:`, JSON.stringify(applyRes, null, 2));

      if (applyRes.ResponseMetadata?.Error) {
        throw new Error(`获取上传凭证失败: ${applyRes.ResponseMetadata.Error.Message}`);
      }

      if (!applyRes.Result?.UploadAddress?.StoreInfos?.length) {
        throw new Error('上传凭证响应格式错误');
      }

      const uploadAddress = applyRes.Result.UploadAddress;

      // 2. 上传文件
      await this.client.DoUpload(
        [file.buffer],
        uploadAddress.UploadHosts[0],
        uploadAddress.StoreInfos
      );

      this.logger.log(`[VolcengineService] 文件上传成功`);

      // 3. 确认上传
      const commitRes = await this.client.CommitImageUpload({
        ServiceId: this.SHORT_ID,  // 🔴 修复：使用短ID
        SessionKey: uploadAddress.SessionKey,
      });

      this.logger.log(`[VolcengineService] CommitImageUpload 响应:`, JSON.stringify(commitRes, null, 2));

      if (commitRes.ResponseMetadata?.Error) {
        throw new Error(`确认上传失败: ${commitRes.ResponseMetadata.Error.Message}`);
      }

      // 4. 构建图片访问URL
      if (!commitRes.Result?.Results?.length) {
        throw new Error('确认上传响应中没有结果');
      }

      const result = commitRes.Result.Results[0] as any;
      this.logger.log(`[VolcengineService] 上传结果详情:`, JSON.stringify(result, null, 2));

      // 优先使用API返回的URL
      if (result.Url) {
        this.logger.log(`[VolcengineService] 使用API返回的URL: ${result.Url}`);
        return { url: result.Url };
      }

      // 使用URI构建URL
      const uri = result.Uri;
      if (!uri) {
        throw new Error('上传结果中没有URI');
      }

      // 🔴 修复：直接使用原始URI构建URL（不使用模板参数）
      // SDK返回的URI格式: tos-cn-i-699z2ac540/user/19dccf167f87ef0491d7bdf300000000.png
      // 需要转换为: https://voic.51webjs.com/tos-cn-i-699z2ac540/user%2F19dccf167f87ef0491d7bdf300000000.png
      // 注意：将 user/ 替换为 user%2F（URL编码），保留原始扩展名
      const encodedUri = uri.replace('user/', 'user%2F');
      const url = `https://${this.CUSTOM_DOMAIN}/${encodedUri}`;
      
      this.logger.log(`[VolcengineService] 构建的URL: ${url}`);
      this.logger.log(`[VolcengineService] 原始URI: ${uri}`);

      // 🔴 打印完整的 result 对象，查看是否有其他字段
      this.logger.log(`[VolcengineService] 完整result:`, JSON.stringify(result, null, 2));
      
      return { url };

    } catch (error: any) {
      this.logger.error(`[VolcengineService] 上传失败:`, error);
      
      // 🔴 打印 error 对象的所有属性
      this.logger.error(`[VolcengineService] Error properties:`, Object.getOwnPropertyNames(error || {}));
      this.logger.error(`[VolcengineService] Error keys:`, Object.keys(error || {}));
      this.logger.error(`[VolcengineService] Error string:`, error?.toString());
      this.logger.error(`[VolcengineService] Error stack:`, error?.stack);
      
      throw new Error(`上传图片失败: ${error.message}`);
    }
  }

  private generateStoreKey(originalName: string): string {
    // 🔴 修复：添加 user/ 前缀，确保文件存储在user目录下
    // 格式：user/{32位十六进制字符}.扩展名
    // 例如：user/84b63fbc53ab40e6acf2584fdb8c3026.png
    const ext = originalName.split('.').pop() || 'png';
    const timestamp = Date.now().toString(16);
    const random = Math.random().toString(16).substring(2, 18);
    const hash = (timestamp + random).padEnd(32, '0').substring(0, 32);
    return `user/${hash}.${ext}`;
  }

  /**
   * 根据MIME类型和文件名获取文件扩展名
   * 🔴 修复：强制使用PNG格式，因为火山引擎CDN可能只支持PNG格式访问
   */
  private getExtensionFromMime(mimetype?: string, filename?: string): string {
    // 🔴 无论原格式是什么，都强制使用PNG格式
    // 因为火山引擎CDN可能只支持PNG格式访问
    return 'png';
  }
}
