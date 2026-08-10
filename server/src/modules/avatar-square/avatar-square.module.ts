import { Module } from '@nestjs/common'
import { AvatarSquareController } from './avatar-square.controller'
import { AvatarSquareService } from './avatar-square.service'
import { GeneratedWorksController } from './generated-works.controller'
import { ContentAuditModule } from '../content-audit/content-audit.module'
import { AuthModule } from '../auth/auth.module'

@Module({
  imports: [ContentAuditModule, AuthModule],
  controllers: [AvatarSquareController, GeneratedWorksController],
  providers: [AvatarSquareService],
})
export class AvatarSquareModule {}