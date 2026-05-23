import { Injectable } from '@nestjs/common';
import { ASRClient, Config } from 'coze-coding-dev-sdk';

@Injectable()
export class AudioService {
  private asrClient: ASRClient;
  private config: Config;

  constructor() {
    this.config = new Config();
    this.asrClient = new ASRClient(this.config);
  }

  async recognizeSpeech(file: Express.Multer.File): Promise<{ text: string; duration?: number }> {
    console.log('[AudioService] 开始语音识别');
    console.log('[AudioService] 文件大小:', file.size, 'bytes');
    console.log('[AudioService] 文件类型:', file.mimetype);

    try {
      let audioUrl: string;
      let audioBase64: string;

      // 方式1: 如果有文件路径（磁盘存储），上传到临时存储获取URL
      if (file.path) {
        console.log('[AudioService] 使用文件路径:', file.path);
        // 这里可以上传到对象存储，暂时使用base64
        const fs = await import('fs');
        const buffer = fs.readFileSync(file.path);
        audioBase64 = buffer.toString('base64');
      } 
      // 方式2: 如果有buffer（内存存储），直接使用base64
      else if (file.buffer) {
        console.log('[AudioService] 使用文件buffer');
        audioBase64 = file.buffer.toString('base64');
      } else {
        throw new Error('无法读取音频文件');
      }

      console.log('[AudioService] Base64长度:', audioBase64.length);

      // 调用ASR识别
      const result = await this.asrClient.recognize({
        uid: 'user-' + Date.now(),
        base64Data: audioBase64,
      });

      console.log('[AudioService] ASR识别成功:', result.text);

      return {
        text: result.text,
        duration: result.duration,
      };
    } catch (error) {
      console.error('[AudioService] 语音识别错误:', error);
      throw error;
    }
  }

  async recognizeFromUrl(url: string): Promise<{ text: string; duration?: number }> {
    console.log('[AudioService] 从URL识别:', url);

    try {
      const result = await this.asrClient.recognize({
        uid: 'user-' + Date.now(),
        url: url,
      });

      console.log('[AudioService] ASR识别成功:', result.text);

      return {
        text: result.text,
        duration: result.duration,
      };
    } catch (error) {
      console.error('[AudioService] 语音识别错误:', error);
      throw error;
    }
  }
}
