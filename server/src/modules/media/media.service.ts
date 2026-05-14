import { Injectable, Inject } from '@nestjs/common'
import { StorageService } from '../storage/storage.service';

@Injectable()
export class MediaService {
  constructor(@Inject(StorageService) private readonly storageService: StorageService) {}

  /**
   * 使用 key 生成签名URL
   * @param key 文件在TOS中的key
   * @param expireTime 过期时间（秒），默认30天
   */
  async generateSignedUrl(key: string, expireTime: number = 86400 * 30): Promise<string> {
    try {
      const signedUrl = await this.storageService.getFileUrl(key, expireTime);
      return signedUrl;
    } catch (error: any) {
      console.error('[MediaService] 生成签名URL失败:', error);
      throw new Error(`生成签名URL失败: ${error.message}`);
    }
  }
}
