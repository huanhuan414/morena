import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminAuthGuard } from './admin-auth.guard'

@Module({
  controllers: [AdminController],
  providers: [AdminService, AdminAuthGuard],
  exports: [AdminService]
})
export class AdminModule {}
