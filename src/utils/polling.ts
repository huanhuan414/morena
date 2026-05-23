type PollerEntry<T> = {
  key: string
  intervalMs: number
  timer: any
  inflight: Promise<T> | null
  subscribers: Set<(data: T) => void>
  fetcher: () => Promise<T>
  lastAt: number
  lastValue: T | null
  ttlMs: number
}

const pollers = new Map<string, PollerEntry<any>>()

const startPolling = (entry: PollerEntry<any>) => {
  const tick = async () => {
    if (entry.inflight) return
    const now = Date.now()
    if (entry.lastValue && now - entry.lastAt <= entry.ttlMs) {
      entry.subscribers.forEach((fn) => fn(entry.lastValue))
      return
    }
    entry.inflight = entry.fetcher()
    try {
      const value = await entry.inflight
      entry.lastValue = value
      entry.lastAt = Date.now()
      entry.subscribers.forEach((fn) => fn(value))
    } catch {
      return
    } finally {
      entry.inflight = null
    }
  }

  void tick()
  entry.timer = setInterval(tick, entry.intervalMs)
}

export const subscribePolling = <T>(params: {
  key: string
  intervalMs: number
  fetcher: () => Promise<T>
  onData: (data: T) => void
  ttlMs?: number
}) => {
  const ttlMs = Number.isFinite(params.ttlMs) ? Math.max(0, params.ttlMs as number) : 300
  const existing = pollers.get(params.key) as PollerEntry<T> | undefined

  if (existing) {
    existing.subscribers.add(params.onData)
    if (params.intervalMs < existing.intervalMs) {
      existing.intervalMs = params.intervalMs
      if (existing.timer) {
        clearInterval(existing.timer)
        existing.timer = null
        startPolling(existing)
      }
    }
    return () => {
      existing.subscribers.delete(params.onData)
      if (existing.subscribers.size === 0) {
        if (existing.timer) clearInterval(existing.timer)
        pollers.delete(params.key)
      }
    }
  }

  const entry: PollerEntry<T> = {
    key: params.key,
    intervalMs: params.intervalMs,
    timer: null,
    inflight: null,
    subscribers: new Set([params.onData]),
    fetcher: params.fetcher,
    lastAt: 0,
    lastValue: null,
    ttlMs,
  }
  pollers.set(params.key, entry)
  startPolling(entry)

  return () => {
    entry.subscribers.delete(params.onData)
    if (entry.subscribers.size === 0) {
      if (entry.timer) clearInterval(entry.timer)
      pollers.delete(entry.key)
    }
  }
}

type ManagedPollerEntry<T> = {
  key: string
  baseIntervalMs: number
  currentIntervalMs: number
  maxIntervalMs: number
  backoffFactor: number
  resetOnSuccess: boolean
  timer: any
  inflight: Promise<T> | null
  subscribers: Set<(data: T) => void>
  onErrorSubscribers: Set<(err: unknown) => void>
  fetcher: () => Promise<T>
  paused: boolean
  canceled: boolean
}

const managedPollers = new Map<string, ManagedPollerEntry<any>>()

const scheduleManagedTick = (entry: ManagedPollerEntry<any>, delayMs?: number) => {
  if (entry.timer) clearTimeout(entry.timer)
  if (entry.canceled || entry.paused) return
  const delay = Number.isFinite(delayMs) ? Math.max(0, delayMs as number) : entry.currentIntervalMs
  entry.timer = setTimeout(() => void runManagedTick(entry), delay)
}

const runManagedTick = async (entry: ManagedPollerEntry<any>) => {
  if (entry.canceled || entry.paused) return
  if (entry.inflight) return
  entry.inflight = entry.fetcher()
  try {
    const value = await entry.inflight
    if (entry.resetOnSuccess) entry.currentIntervalMs = entry.baseIntervalMs
    entry.subscribers.forEach((fn) => fn(value))
  } catch (err) {
    entry.currentIntervalMs = Math.min(
      entry.maxIntervalMs,
      Math.max(entry.baseIntervalMs, Math.floor(entry.currentIntervalMs * entry.backoffFactor))
    )
    entry.onErrorSubscribers.forEach((fn) => fn(err))
  } finally {
    entry.inflight = null
    scheduleManagedTick(entry)
  }
}

export const subscribeManagedPolling = <T>(params: {
  key: string
  baseIntervalMs: number
  fetcher: () => Promise<T>
  onData: (data: T) => void
  onError?: (err: unknown) => void
  maxIntervalMs?: number
  backoffFactor?: number
  resetOnSuccess?: boolean
}) => {
  const existing = managedPollers.get(params.key) as ManagedPollerEntry<T> | undefined
  if (existing) {
    existing.subscribers.add(params.onData)
    if (params.onError) existing.onErrorSubscribers.add(params.onError)
    if (params.baseIntervalMs < existing.baseIntervalMs) {
      existing.baseIntervalMs = params.baseIntervalMs
      existing.currentIntervalMs = Math.min(existing.currentIntervalMs, existing.baseIntervalMs)
    }
    scheduleManagedTick(existing, 0)
    return {
      pause: () => {
        existing.paused = true
        if (existing.timer) clearTimeout(existing.timer)
        existing.timer = null
      },
      resume: () => {
        if (existing.canceled) return
        existing.paused = false
        scheduleManagedTick(existing, 0)
      },
      unsubscribe: () => {
        existing.subscribers.delete(params.onData)
        if (params.onError) existing.onErrorSubscribers.delete(params.onError)
        if (existing.subscribers.size === 0) {
          existing.canceled = true
          if (existing.timer) clearTimeout(existing.timer)
          managedPollers.delete(existing.key)
        }
      },
      cancel: () => {
        existing.canceled = true
        existing.subscribers.clear()
        existing.onErrorSubscribers.clear()
        if (existing.timer) clearTimeout(existing.timer)
        managedPollers.delete(existing.key)
      },
    }
  }

  const entry: ManagedPollerEntry<T> = {
    key: params.key,
    baseIntervalMs: params.baseIntervalMs,
    currentIntervalMs: params.baseIntervalMs,
    maxIntervalMs: Number.isFinite(params.maxIntervalMs) ? Math.max(params.baseIntervalMs, params.maxIntervalMs as number) : 30_000,
    backoffFactor: Number.isFinite(params.backoffFactor) ? Math.max(1.2, params.backoffFactor as number) : 2,
    resetOnSuccess: params.resetOnSuccess !== false,
    timer: null,
    inflight: null,
    subscribers: new Set([params.onData]),
    onErrorSubscribers: params.onError ? new Set([params.onError]) : new Set(),
    fetcher: params.fetcher,
    paused: false,
    canceled: false,
  }

  managedPollers.set(entry.key, entry)
  scheduleManagedTick(entry, 0)

  return {
    pause: () => {
      entry.paused = true
      if (entry.timer) clearTimeout(entry.timer)
      entry.timer = null
    },
    resume: () => {
      if (entry.canceled) return
      entry.paused = false
      scheduleManagedTick(entry, 0)
    },
    unsubscribe: () => {
      entry.subscribers.delete(params.onData)
      if (params.onError) entry.onErrorSubscribers.delete(params.onError)
      if (entry.subscribers.size === 0) {
        entry.canceled = true
        if (entry.timer) clearTimeout(entry.timer)
        managedPollers.delete(entry.key)
      }
    },
    cancel: () => {
      entry.canceled = true
      entry.subscribers.clear()
      entry.onErrorSubscribers.clear()
      if (entry.timer) clearTimeout(entry.timer)
      managedPollers.delete(entry.key)
    },
  }
}
