import { Inject, Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express';
import { AudioService } from './audio.service';

@Controller('audio')
export class AudioController {
  constructor(@Inject(AudioService) private readonly audioService: AudioService) {}

  @Post('asr')
  @UseInterceptors(FileInterceptor('audio'))
  async recognizeSpeech(@UploadedFile() file: Express.Multer.File) {
    console.log('[AudioController] 收到语音识别请求');
    console.log('[AudioController] 文件信息:', {
      fieldname: file?.fieldname,
      originalname: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype,
      hasPath: !!file?.path,
      hasBuffer: !!file?.buffer,
    });

    if (!file) {
      throw new BadRequestException('未上传音频文件');
    }

    try {
      const result = await this.audioService.recognizeSpeech(file);
      console.log('[AudioController] 识别结果:', result);
      
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
