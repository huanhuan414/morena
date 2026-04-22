import { Controller, Get } from '@nestjs/common'
import { TestService } from './test.service'

@Controller('test')
export class TestController {
  constructor(private readonly testService: TestService) {}

  @Get('tikhub')
  async testTikHub() {
    try {
      const result = await this.testService.testTikHubAPI()
      return {
        code: 200,
        data: result,
        message: '测试成功'
      }
    } catch (error: any) {
      return {
        code: 500,
        data: null,
        message: error.message || '测试失败'
      }
    }
  }
}
