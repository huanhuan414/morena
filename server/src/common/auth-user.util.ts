import { ForbiddenException, UnauthorizedException } from '@nestjs/common'
import * as crypto from 'crypto'

function pickFirst(value?: string | string[]): string | null {
  if (Array.isArray(value)) {
    return typeof value[0] === 'string' ? value[0] : null
  }
  return typeof value === 'string' ? value : null
}

export function extractAuthorizationToken(authHeader?: string | string[]): string | null {
  const raw = pickFirst(authHeader)?.trim()
  if (!raw) {
    return null
  }

  const matched = raw.match(/^Bearer\s+(.+)$/i)
  if (matched) {
    return matched[1].trim()
  }

  return raw
}

export function verifyAuthToken(token: string): string | null {
  try {
    const [encoded, signature] = token.split('.')
    if (!encoded || !signature) {
      return null
    }

    const secret = process.env.JWT_SECRET
    if (!secret) {
      return null
    }
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(encoded)
      .digest('hex')

    if (signature !== expectedSignature) {
      return null
    }

    const payload = JSON.parse(Buffer.from(encoded, 'base64').toString())
    if (!payload?.userId || !payload?.exp) {
      return null
    }

    if (Date.now() > Number(payload.exp)) {
      return null
    }

    return String(payload.userId)
  } catch {
    return null
  }
}

export function requireAuthenticatedUserId(headers: Record<string, string | string[] | undefined>): string {
  const token = extractAuthorizationToken(headers.authorization || headers.Authorization)
  if (!token) {
    throw new UnauthorizedException('请先登录')
  }

  const userId = verifyAuthToken(token)
  if (!userId) {
    throw new UnauthorizedException('登录已过期')
  }

  const headerUserId = pickFirst(headers['x-user-id'] || headers['X-User-Id'])?.trim()
  if (headerUserId && headerUserId !== userId) {
    throw new UnauthorizedException('身份校验失败')
  }

  return userId
}

export function requireMatchedAuthenticatedUserId(
  headers: Record<string, string | string[] | undefined>,
  expectedUserId?: string | string[] | null
): string {
  const userId = requireAuthenticatedUserId(headers)
  const normalizedExpectedUserId = pickFirst(expectedUserId || undefined)?.trim()
  if (normalizedExpectedUserId && normalizedExpectedUserId !== userId) {
    throw new UnauthorizedException('身份校验失败')
  }
  return userId
}

export function assertResourceOwner(
  authenticatedUserId: string,
  resourceOwnerUserId?: string | null,
  message: string = '无权访问该资源'
) {
  if (resourceOwnerUserId && resourceOwnerUserId !== authenticatedUserId) {
    throw new ForbiddenException(message)
  }
}

export function rethrowAuthError(error: unknown) {
  if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
    throw error
  }
}
