export function unwrapList(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.list)) return payload.list
  if (Array.isArray(payload?.data?.list)) return payload.data.list
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export function unwrapObject<T extends Record<string, any>>(payload: any, fallback: T): T {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
      return { ...fallback, ...payload.data }
    }
    return { ...fallback, ...payload }
  }
  return fallback
}

export function unwrapValue<T>(payload: any, fallback: T): T {
  if (payload === undefined || payload === null) {
    return fallback
  }
  if (payload && typeof payload === 'object' && 'data' in payload && payload.data !== undefined) {
    return payload.data as T
  }
  return payload as T
}
