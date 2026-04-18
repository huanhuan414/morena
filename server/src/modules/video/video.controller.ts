import { Controller, Post, Body, Headers } from '@nestjs/common';
import { VideoService } from './video.service';

@Controller('video')
export class VideoController {
  constructor(private readonly videoService: VideoService) {}

  /**
   * 生成莫瑞娜推广视频
   */
  @Post('generate-promo')
  async generatePromoVideo(
    @Body() body: { duration?: number; ratio?: string },
    @Headers() headers: Record<string, string>
  ) {
    const { duration = 7, ratio = '9:16' } = body;
    return this.videoService.generateMorinaPromoVideo(duration, ratio, headers);
  }
}
