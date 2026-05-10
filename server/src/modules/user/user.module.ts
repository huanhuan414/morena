// @ts-nocheck
import { Module, Global } from '@nestjs/common'
import { UserService } from './user.service'

@Global()
@Module({
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
