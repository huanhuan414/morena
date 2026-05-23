import { Injectable, Logger } from '@nestjs/common';
import { ImageXClient } from '@volcengine/imagex-openapi';
import * as fs from 'fs'
import * as path from 'path'

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
  private client: ImageXClient | null;

  // 图片服务
  private readonly FULL_SERVICE_ID = 'tos-cn-i-699z2ac540';
  private readonly SHORT_ID = '699z2ac540';
  private readonly CUSTOM_DOMAIN = 'voic.51webjs.com';

  // 视频服务
  private readonly VIDEO_SHORT_ID = '4rj1sb5o2t';

  constructor() {
    const accessKey = process.env.VOLC_ACCESS_KEY || ''
    const secretKey = process.env.VOLC_SECRET_KEY || ''
    if (!accessKey || !secretKey) {
      this.client = null
      this.logger.warn('VOLC_ACCESS_KEY / VOLC_SECRET_KEY 未配置，Volcengine 上传能力将不可用')
      return
    }

    this.client = new ImageXClient({
      accessKey,
      secretKey,
      region: 'cn-north-1',
      host: 'imagex.volcengineapi.com',
    })
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[VolcengineService] 开始上传图片: ${file.originalname}, MIME: ${file.mimetype}`);

    try {
      if (!this.client) {
        if (process.env.NODE_ENV !== 'production' && process.env.STORAGE_MOCK === '1') {
          return { url: this.saveLocalFile(file, 'images') }
        }
        throw new Error('Volcengine client 未初始化（缺少 VOLC_ACCESS_KEY / VOLC_SECRET_KEY）')
      }

      // 🔴 修复：强制所有文件都使用PNG格式
      // 因为火山引擎CDN可能只支持PNG格式访问
      // 根据原始文件名生成新的文件名，但强制使用PNG扩展名
      let originalname = file.originalname;
      if (!originalname || originalname.startsWith('.') || !originalname.includes('.')) {
        originalname = `image_${Date.now()}.png`;
      } else {
        // 🔴 将文件扩展名强制改为.png
        originalname = originalname.replace(/\.[^.]+$/, '.png');
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
      // 🔴 修复：确保文件内容存在
      if (!file.buffer || file.buffer.length === 0) {
        throw new Error('文件内容为空');
      }

      this.logger.log(`[VolcengineService] 开始上传文件，大小: ${file.buffer.length} bytes`);

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

      // 🔴 检查result中是否有Uri字段
      if (!result.Uri) {
        throw new Error('上传结果中没有URI');
      }

      // 🔴 按照用户提供的正确格式构建URL
      // 用户提供的格式：https://voic.51webjs.com/tos-cn-i-699z2ac540/user%2F84b63fbc53ab40e6acf2584fdb8c3026.mf~tplv-699z2ac540-image.png
      // SDK返回的Uri格式：tos-cn-i-699z2ac540/user/84b63fbc53ab40e6acf2584fdb8c3026.png
      // 转换步骤：
      // 1. 将 Uri 中的 user/ 替换为 user%2F（URL编码）
      // 2. 添加模板后缀 ~tplv-{短ID}-image.png
      const uri = result.Uri;
      const encodedUri = uri.replace('user/', 'user%2F');
      const url = `https://${this.CUSTOM_DOMAIN}/${encodedUri}~tplv-${this.SHORT_ID}-image.png`;

      this.logger.log(`[VolcengineService] 构建的URL: ${url}`);
      this.logger.log(`[VolcengineService] 原始URI: ${uri}`);

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

  private saveLocalFile(file: Express.Multer.File, subDir: string): string {
    const projectRoot = process.cwd().includes('server') ? path.join(process.cwd(), '..') : process.cwd()
    const uploadsRoot = path.join(projectRoot, 'uploads', subDir)
    fs.mkdirSync(uploadsRoot, { recursive: true })

    const original = file.originalname || `file_${Date.now()}`
    const ext = path.extname(original) || '.png'
    const nonce = Math.random().toString(36).slice(2, 10)
    const name = `${Date.now()}_${nonce}${ext}`
    const filePath = path.join(uploadsRoot, name)
    fs.writeFileSync(filePath, file.buffer)

    const base = process.env.LOCAL_UPLOAD_BASE_URL || 'http://127.0.0.1:3000'
    return `${base}/uploads/${subDir}/${name}`
  }

  private generateStoreKey(originalName: string): string {
    // 🔴 修复：生成纯随机的32位16进制字符（不使用padEnd填充0）
    // 用户提供的文件名示例：84b63fbc53ab40e6acf2584fdb8c3026（32位16进制字符）
    // 格式：user/{32位纯随机16进制字符}.扩展名
    const ext = originalName.split('.').pop() || 'png';

    // 生成32位纯随机16进制字符串
    let hash = '';
    for (let i = 0; i < 8; i++) {
      hash += Math.random().toString(16).substring(2, 6);
    }
    hash = hash.substring(0, 32);

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

  /**
   * 上传视频到 veImageX 视频服务（永久CDN URL，不会过期）
   */
  async uploadVideo(videoBuffer: Buffer, fileName?: string): Promise<{ url: string }> {
    this.logger.log(`[VolcengineService] 开始上传视频，大小: ${videoBuffer.length} bytes`);

    try {
      if (!this.client) {
        throw new Error('Volcengine client 未初始化（缺少 VOLC_ACCESS_KEY / VOLC_SECRET_KEY）')
      }

      const name = fileName || `video_${Date.now()}.mp4`;
      const storeKey = this.generateVideoStoreKey(name);
      this.logger.log(`[VolcengineService] Video StoreKey: ${storeKey}`);

      // 1. 获取上传凭证
      const applyRes = await this.client.ApplyImageUpload({
        ServiceId: this.VIDEO_SHORT_ID,
        UploadNum: 1,
        StoreKeys: [storeKey],
      });

      if (applyRes.ResponseMetadata?.Error) {
        throw new Error(`获取视频上传凭证失败: ${applyRes.ResponseMetadata.Error.Message}`);
      }

      if (!applyRes.Result?.UploadAddress?.StoreInfos?.length) {
        throw new Error('视频上传凭证响应格式错误');
      }

      const uploadAddress = applyRes.Result.UploadAddress;

      // 2. 上传文件
      await this.client.DoUpload(
        [videoBuffer],
        uploadAddress.UploadHosts[0],
        uploadAddress.StoreInfos
      );

      this.logger.log(`[VolcengineService] 视频文件上传成功`);

      // 3. 确认上传
      const commitRes = await this.client.CommitImageUpload({
        ServiceId: this.VIDEO_SHORT_ID,
        SessionKey: uploadAddress.SessionKey,
      });

      if (commitRes.ResponseMetadata?.Error) {
        throw new Error(`确认视频上传失败: ${commitRes.ResponseMetadata.Error.Message}`);
      }

      if (!commitRes.Result?.Results?.length) {
        throw new Error('确认视频上传响应中没有结果');
      }

      const result = commitRes.Result.Results[0] as any;

      if (!result.Uri) {
        throw new Error('视频上传结果中没有URI');
      }

      // 4. 构建视频访问URL
      // 视频URL格式与图片类似：https://{domain}/{serviceId}/user%2F{file}~tplv-{shortId}-video.mp4
      const uri = result.Uri;
      const encodedUri = uri.replace('user/', 'user%2F');
      const url = `https://${this.CUSTOM_DOMAIN}/${encodedUri}~tplv-${this.VIDEO_SHORT_ID}-video.mp4`;

      this.logger.log(`[VolcengineService] 视频URL: ${url}`);
      return { url };

    } catch (error: any) {
      this.logger.error(`[VolcengineService] 视频上传失败: ${error.message}`);
      throw new Error(`上传视频失败: ${error.message}`);
    }
  }

  private generateVideoStoreKey(originalName: string): string {
    const ext = originalName.split('.').pop() || 'mp4';
    let hash = '';
    for (let i = 0; i < 8; i++) {
      hash += Math.random().toString(16).substring(2, 6);
    }
    hash = hash.substring(0, 32);
    return `user/${hash}.${ext}`;
  }
}
