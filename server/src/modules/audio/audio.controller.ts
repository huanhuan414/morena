import { Inject, Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioService } from './audio.service';

@Controller('audio')
export class AudioController {
  constructor(@Inject(AudioService) private readonly audioService: AudioService) {}

  @Post('asr')
  @UseInterceptors(FileInterceptor('audio'))
  async recognizeSpeech(@UploadedFile() file: Express.Multer.File) {

    if (!file) {
      throw new BadRequestException('未上传音频文件');
    }

    try {
      const result = await this.audioService.recognizeSpeech(file);
      
      return {
        code: 200,
        msg: '识别成功',
        data: result,
      };
    } catch (error) {
      console.error('[AudioController] 识别失败:', error);
      throw new BadRequestException('语音识别失败: ' + error.message);
    }
  }
}
