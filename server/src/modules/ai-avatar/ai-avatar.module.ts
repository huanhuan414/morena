import { Module } from '@nestjs/common'

import { CoinModule } from '../coin/coin.module'
import { UploadModule } from '../upload/upload.module'
import { AiAvatarController } from './ai-avatar.controller'
import { AiAvatarService } from './ai-avatar.service'

@Module({
  imports: [CoinModule, UploadModule],
  controllers: [AiAvatarController],
  providers: [AiAvatarService],
  exports: [AiAvatarService],
})
export class AiAvatarModule {}
