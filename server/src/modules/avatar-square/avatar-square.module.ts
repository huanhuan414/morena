import { Module } from '@nestjs/common'
import { AvatarSquareController } from './avatar-square.controller'
import { AvatarSquareService } from './avatar-square.service'
import { GeneratedWorksController } from './generated-works.controller'

@Module({
  controllers: [AvatarSquareController, GeneratedWorksController],
  providers: [AvatarSquareService],
})
export class AvatarSquareModule {}