import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthSmsService } from './sms.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthSmsService,
    {
      provide: 'AUTH_SERVICE',
      useClass: AuthService
    },
    {
      provide: 'AUTH_SMS_SERVICE',
      useClass: AuthSmsService
    }
  ]
})
export class AuthModule {}
