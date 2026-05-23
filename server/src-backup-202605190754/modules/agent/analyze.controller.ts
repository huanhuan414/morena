import { Controller, Post, Body } from '@nestjs/common';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

@Controller('analyze')
export class AnalyzeController {
  @Post('layout')
  async analyzeLayout(@Body() body: { imageUrl: string }) {
    const { imageUrl } = body;
    const config = new Config();
    const client = new LLMClient(config);

    const messages: any[] = [
      {
        role: 'system',
        content: '你是一个专业的 UI/UX 设计师，擅长分析聊天应用的输入栏布局。请详细描述图片中输入栏的布局结构，包括按钮的位置、大小、间距、排列方式等。',
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请详细描述这个聊天页面底部输入栏的布局设计，包括：1. 所有按钮的位置和排列方式 2. 按钮的大小和样式 3. 输入框的位置和样式 4. 整体的布局结构',
          },
          {
            type: 'image_url',
            image_url: {
              url: imageUrl,
              detail: 'high',
            },
          },
        ],
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.3,
    });

    return {
      code: 200,
      msg: '分析成功',
      data: {
        analysis: response.content,
      },
    };
  }
}
