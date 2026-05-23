type WaitOptions = {
  url: string
  timeoutMs: number
  intervalMs: number
}

async function waitForHttp(options: WaitOptions): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < options.timeoutMs) {
    try {
      const res = await fetch(options.url, { method: 'GET' })
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, options.intervalMs))
  }
  throw new Error(`waitForHttp timeout: ${options.url}`)
}

async function main(): Promise<void> {
  const url = process.env.WAIT_URL
  if (!url) throw new Error('missing env WAIT_URL')
  const timeoutMs = Number(process.env.WAIT_TIMEOUT_MS ?? 60_000)
  const intervalMs = Number(process.env.WAIT_INTERVAL_MS ?? 800)
  await waitForHttp({ url, timeoutMs, intervalMs })
}

void main()
