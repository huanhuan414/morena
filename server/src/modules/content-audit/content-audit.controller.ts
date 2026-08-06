import { Body, Controller, Post } from '@nestjs/common'
import { ContentAuditItem, ContentAuditPayload, ContentAuditService } from './content-audit.service'

@Controller('content-audit')
export class ContentAuditController {
  constructor(private readonly contentAuditService: ContentAuditService) {}

  @Post('porn')
  async reviewPorn(@Body() body: ContentAuditPayload | ContentAuditItem[]) {
    const result = await this.contentAuditService.reviewPorn(body)
    return { code: 200, msg: 'success', data: result }
  }
}
