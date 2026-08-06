import { Module } from '@nestjs/common'
import { ContentAuditController } from './content-audit.controller'
import { ContentAuditService } from './content-audit.service'

@Module({
  controllers: [ContentAuditController],
  providers: [ContentAuditService],
  exports: [ContentAuditService],
})
export class ContentAuditModule {}
