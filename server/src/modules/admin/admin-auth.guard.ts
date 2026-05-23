import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AdminService } from './admin.service'

export const ADMIN_PUBLIC_KEY = 'admin:public'

export const PublicAdmin = () => SetMetadata(ADMIN_PUBLIC_KEY, true)

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly adminService: AdminService
  ) {}

  private getAdminAuthHeader(headers: Record<string, string | string[] | undefined>): string | undefined {
    const authorization = headers.authorization ?? headers.Authorization
    const adminToken = headers['admin_token'] ?? headers['admin-token'] ?? headers['Admin-Token']

    const firstValue = (value: string | string[] | undefined): string | undefined =>
      Array.isArray(value) ? value[0] : value

    return firstValue(authorization) ?? firstValue(adminToken)
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(ADMIN_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass()
    ])
    if (isPublic) {
      return true
    }

    const request = context
      .switchToHttp()
      .getRequest<{ headers?: Record<string, string | string[] | undefined>; admin?: unknown }>()
    const admin = await this.adminService.verifyToken(this.getAdminAuthHeader(request.headers ?? {}) || '')
    if (!admin) {
      throw new UnauthorizedException({ code: 401, data: null, message: '未授权' })
    }

    request.admin = admin
    return true
  }
}
