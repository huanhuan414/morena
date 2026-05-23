import { Network } from '@/network'

type AdminRequestOptions = Parameters<typeof Network.request>[0]

const normalizeAdminUrl = (url: string) => {
  if (!url) {
    return '/api/admin'
  }

  if (url.startsWith('/api/admin')) {
    return url
  }

  if (url.startsWith('/')) {
    return `/api/admin${url}`
  }

  return `/api/admin/${url}`
}

export const adminRequest = (options: AdminRequestOptions) => {
  return Network.request({
    ...options,
    url: normalizeAdminUrl(options.url),
  })
}
