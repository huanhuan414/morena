import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ASRClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { Request } from 'express';

@Injectable()
export class AsrService {
  async recognizeAudio(audioUrl: string): Promise<{ text: string; duration?: number }> {
    try {

      // 创建 ASR 客户端
      const config = new Config();
      const asrClient = new ASRClient(config);

      // 调用语音识别
      const result = await asrClient.recognize({
        uid: 'user_' + Date.now(),
        url: audioUrl
      });


      return {
        text: result.text || '',
        duration: result.duration
      };
    } catch (error) {
      console.error('[ASR] 识别失败:', error);
      throw new HttpException(
        error.message || '语音识别失败',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
