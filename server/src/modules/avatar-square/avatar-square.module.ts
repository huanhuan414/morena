import { Module } from '@nestjs/common'
import { AvatarSquareController } from './avatar-square.controller'
import { AvatarSquareService } from './avatar-square.service'
import { GeneratedWorksController } from './generated-works.controller'
import { ContentAuditModule } from '../content-audit/content-audit.module'

@Module({
  imports: [ContentAuditModule],
  controllers: [AvatarSquareController, GeneratedWorksController],
  providers: [AvatarSquareService],
})
export class AvatarSquareModule {}