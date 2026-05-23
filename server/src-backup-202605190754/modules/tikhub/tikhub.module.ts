import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ConfigModule } from '@nestjs/config'
import { TikHubController } from './tikhub.controller'
import { TikHubService } from './tikhub.service'

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [TikHubController],
  providers: [TikHubService],
  exports: [TikHubService],
})
export class TikHubModule {}
