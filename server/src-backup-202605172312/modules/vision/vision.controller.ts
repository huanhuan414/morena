import { Controller, Post, Body } from '@nestjs/common';
import { LLMClient, Config } from 'coze-coding-dev-sdk';

@Controller('vision')
export class VisionController {
  private readonly llmClient: LLMClient;

  constructor() {
    const config = new Config();
    this.llmClient = new LLMClient(config);
  }

  @Post('analyze')
  async analyzeImage(@Body() body: { imageUrl: string }) {
    const { imageUrl } = body;

    const messages: any[] = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: '请详细描述这个UI界面的布局和样式，包括：1. 输入框的样式和位置 2. 上传按钮的样式和位置 3. 整体布局结构 4. 颜色、圆角、边距等视觉细节 5. 任何文字内容。请尽可能详细地描述，以便我能够完全复刻这个界面。',
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

    const response = await this.llmClient.invoke(messages, {
      model: 'doubao-seed-1-6-vision-250815',
      temperature: 0.7,
    });

    return { description: response.content };
  }
}
