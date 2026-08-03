import { Module } from '@nestjs/common'

import { MyAvatarController } from './my-avatar.controller'
import { MyAvatarService } from './my-avatar.service'

@Module({
  controllers: [MyAvatarController],
  providers: [MyAvatarService],
})
export class MyAvatarModule {}
