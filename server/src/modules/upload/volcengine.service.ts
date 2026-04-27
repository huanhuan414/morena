import { Injectable, Logger } from '@nestjs/common';
import { ImageXClient } from '@volcengine/imagex-openapi';

@Injectable()
export class VolcengineService {
  private readonly logger = new Logger(VolcengineService.name);
  private client: ImageXClient;

  constructor() {
    this.client = new ImageXClient({
      accessKey: process.env.VOLC_ACCESS_KEY || '',
      secretKey: process.env.VOLC_SECRET_KEY || '',
      region: 'cn-north-1',
      host: 'imagex.volcengineapi.com',
    });
  }

  async uploadImage(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[VolcengineService] 开始上传图片: ${file.originalname}`);

    try {
      const serviceId = process.env.VOLCENGINE_IMAGE_SERVICE_ID || '';
      this.logger.log(`[VolcengineService] 服务ID: '${serviceId}'`);

      // 1. 获取上传凭证
      const applyRes = await this.client.ApplyImageUpload({
        ServiceId: serviceId,
        UploadNum: 1,
        StoreKeys: [this.generateStoreKey(file.originalname)],
      });

      this.logger.log(`[VolcengineService] API调用完成，完整响应:`, JSON.stringify(applyRes, null, 2));

      // 检查是否有错误
      if (applyRes.ResponseMetadata?.Error) {
        throw new Error(`获取上传凭证失败: ${applyRes.ResponseMetadata.Error.Code} - ${applyRes.ResponseMetadata.Error.Message}`);
      }

      if (!applyRes.Result) {
        throw new Error('获取上传凭证失败: 响应中没有Result字段');
      }

      const uploadAddress = applyRes.Result.UploadAddress;
      if (!uploadAddress || !uploadAddress.StoreInfos || uploadAddress.StoreInfos.length === 0) {
        throw new Error('上传凭证响应格式错误: 缺少UploadAddress或StoreInfos');
      }

      const sessionKey = uploadAddress.SessionKey;
      this.logger.log(`[VolcengineService] SessionKey: ${sessionKey}`);

      // 2. 使用SDK的DoUpload方法上传文件
      // DoUpload需要files (可以是字符串路径或Buffer/Stream数组)、uploadHost和storeInfos
      await this.client.DoUpload(
        [file.buffer], // 文件Buffer数组
        uploadAddress.UploadHosts[0], // 上传地址
        uploadAddress.StoreInfos // StoreInfo数组
      );

      this.logger.log(`[VolcengineService] 上传文件成功`);

      // 3. 确认上传
      const commitRes = await this.client.CommitImageUpload({
        ServiceId: serviceId,
        SessionKey: sessionKey,
      });

      this.logger.log(`[VolcengineService] 确认上传成功:`, JSON.stringify(commitRes, null, 2));

      // 4. 获取文件URL
      // 根据veImageX文档，需要使用服务配置的访问域名
      // 🔴 修复：使用火山引擎官方默认域名，避免自定义域名配置问题
      const defaultDomain = 'tos-cn-beijing.ivolces.com';
      this.logger.log(`[VolcengineService] 使用域名: ${defaultDomain}`);

      if (commitRes.Result?.Results && commitRes.Result.Results.length > 0) {
        const uri = commitRes.Result.Results[0].Uri;
        const url = `https://${defaultDomain}/${uri}`;
        this.logger.log(`[VolcengineService] 上传成功，URL: ${url}`);
        return { url };
      }

      throw new Error('无法获取上传后的URL');
    } catch (error) {
      this.logger.error(`[VolcengineService] 上传图片失败:`, error);
      throw new Error(`上传图片失败: ${error.message}`);
    }
  }

  /**
   * 上传视频
   * 注意：veImageX只支持图片上传，不支持视频上传
   * 视频上传应该使用VOD服务或对象存储
   */
  async uploadVideo(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[VolcengineService] veImageX不支持视频上传，请使用对象存储`);
    throw new Error('veImageX只支持图片上传，不支持视频上传。请使用对象存储或VOD服务。');
  }

  /**
   * 上传音频（暂未实现）
   * 注意：veImageX不支持音频上传
   */
  async uploadAudio(file: Express.Multer.File): Promise<{ url: string }> {
    this.logger.log(`[VolcengineService] veImageX不支持音频上传，请使用对象存储`);
    throw new Error('veImageX不支持音频上传，请使用对象存储。');
  }

  /**
   * 生成StoreKey
   */
  private generateStoreKey(filename: string): string {
    const ext = filename.includes('.') ? filename.substring(filename.lastIndexOf('.')) : '';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    return `${timestamp}_${random}${ext}`;
  }
}
