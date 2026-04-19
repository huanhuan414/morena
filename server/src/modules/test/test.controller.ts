import { Controller, Get } from '@nestjs/common';

@Controller('test')
export class TestController {
  @Get('env')
  getEnv() {
    return {
      envVars: {
        WECHAT_PAY_MCHID: process.env.WECHAT_PAY_MCHID ? 'SET' : 'NOT SET',
        WECHAT_PAY_APPID: process.env.WECHAT_PAY_APPID ? 'SET' : 'NOT SET',
        WECHAT_PAY_SERIAL_NO: process.env.WECHAT_PAY_SERIAL_NO ? 'SET' : 'NOT SET',
        WECHAT_PAY_APIV3_KEY: process.env.WECHAT_PAY_APIV3_KEY ? 'SET' : 'NOT SET',
        WECHAT_PAY_PRIVATE_KEY: process.env.WECHAT_PAY_PRIVATE_KEY ? 'SET' : 'NOT SET',
        WECHAT_PAY_PUBLIC_KEY: process.env.WECHAT_PAY_PUBLIC_KEY ? 'SET' : 'NOT SET',
      },
      values: {
        WECHAT_PAY_MCHID: process.env.WECHAT_PAY_MCHID,
        WECHAT_PAY_APPID: process.env.WECHAT_PAY_APPID,
        WECHAT_PAY_SERIAL_NO: process.env.WECHAT_PAY_SERIAL_NO,
      },
      timestamp: new Date().toISOString()
    };
  }
}
