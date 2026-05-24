import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ASRClient, Config } from 'coze-coding-dev-sdk';
import { HeaderUtils } from 'coze-coding-dev-sdk';
import { Request } from 'express';

class AsrRequestDto {
  audioUrl: string;
  uid?: string;
}

class AsrResponseDto {
  code: number;
  msg: string;
  data?: {
    text: string;
    duration?: number;
  };
}

@Controller('asr')
export class AsrController {
  @Post('recognize')
  @HttpCode(HttpStatus.OK)
  async recognize(@Body() body: AsrRequestDto, @Req() req: Request): Promise<AsrResponseDto> {
    try {

      // 提取并转发请求头（用于追踪和认证）
      const customHeaders = HeaderUtils.extractForwardHeaders(req.headers as Record<string, string>);

      // 创建 ASR 客户端（带自定义请求头）
      const config = new Config();
      const asrClient = new ASRClient(config, customHeaders);

      // 调用语音识别
      const result = await asrClient.recognize({
        uid: body.uid || 'guest',
        url: body.audioUrl,
      });


      return {
        code: 200,
        msg: '识别成功',
        data: {
          text: result.text,
          duration: result.duration,
        },
      };
    } catch (error) {
      console.error('[ASR] 语音识别失败:', error);

      return {
        code: 500,
        msg: error instanceof Error ? error.message : '识别失败',
      };
    }
  }
}
