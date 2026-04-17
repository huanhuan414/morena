import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { AsrService } from './asr.service';

@Controller('asr')
export class AsrController {
  constructor(private readonly asrService: AsrService) {}

  @Post('recognize')
  async recognize(@Body() body: { audioUrl: string }) {
    try {
      console.log('[ASR] 收到语音识别请求:', { audioUrl: body.audioUrl });

      if (!body.audioUrl) {
        throw new HttpException('缺少音频URL参数', HttpStatus.BAD_REQUEST);
      }

      const result = await this.asrService.recognizeAudio(body.audioUrl);

      console.log('[ASR] 语音识别成功:', { text: result.text });

      return {
        code: 200,
        message: '识别成功',
        data: result
      };
    } catch (error) {
      console.error('[ASR] 语音识别失败:', error);
      throw new HttpException(
        error.message || '语音识别失败',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
