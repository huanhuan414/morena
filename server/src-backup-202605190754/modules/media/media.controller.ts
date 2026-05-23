import { Inject, Controller, Get, Query } from '@nestjs/common'
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(@Inject(MediaService) private readonly mediaService: MediaService) {}

  /**
   * 使用 key 重新生成签名URL
   * @param key 文件在TOS中的key
   */
  @Get('sign-url')
  async generateSignedUrl(@Query('key') key: string) {
    if (!key) {
      return {
        code: 400,
        message: 'key 参数不能为空',
        data: null
      };
    }

    try {
      const signedUrl = await this.mediaService.generateSignedUrl(key);
      return {
        code: 200,
        message: '生成签名URL成功',
        data: {
          url: signedUrl,
          key: key
        }
      };
    } catch (error: any) {
      console.error('[MediaController] 生成签名URL失败:', error);
      return {
        code: 500,
        message: '生成签名URL失败: ' + error.message,
        data: null
      };
    }
  }
}
