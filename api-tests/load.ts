import fs from 'node:fs'

import dotenv from 'dotenv'

dotenv.config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' })

type Endpoint = {
  id: string
  method: string
  path: string
  weight: number
  headers?: Record<string, string>
  body?: unknown
  expectStatus?: number
}

type Stage = {
  name: string
  durationSec: number
  concurrency: number
}

type Options = {
  baseUrl: string
  timeoutMs: number
  maxLatencySamples: number
  token?: string
  vars: Record<string, string>
  endpoints: Endpoint[]
  stages: Stage[]
}

type Sample = {
  ms: number
  ok: boolean
  status: number
  bytes: number
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith('--')) continue
    const key = a.slice(2)
    const val = argv[++i] ?? ''
    out[key] = val
  }
  return out
}

function templateStr(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{([a-zA-Z0-9_.$-]+)\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim()
    return vars[key] ?? process.env[key] ?? ''
  })
}

function buildUrl(baseUrl: string, path: string, vars: Record<string, string>): string {
  const p = templateStr(path, vars).replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
    const v = vars[key] ?? process.env[key]
    return v && v.length > 0 ? v : 'test'
  })
  return new URL(ensureSlash(baseUrl) + p).toString()
}

function chooseWeighted(endpoints: Endpoint[]): Endpoint {
  const total = endpoints.reduce((sum, e) => sum + Math.max(0, e.weight), 0)
  const r = Math.random() * (total || 1)
  let acc = 0
  for (const e of endpoints) {
    acc += Math.max(0, e.weight)
    if (r <= acc) return e
  }
  return endpoints[endpoints.length - 1]
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}

async function consumeBytes(res: Response): Promise<number> {
  const body: any = res.body
  if (!body) return 0
  let total = 0
  for await (const chunk of body) {
    if (chunk) total += Buffer.byteLength(chunk)
  }
  return total
}

async function requestOnce(args: {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
  timeoutMs: number
  expectStatus?: number
}): Promise<Sample> {
  const controller = new AbortController()
  const started = Date.now()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), args.timeoutMs)
  try {
    const res = await fetch(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      signal: controller.signal,
    })
    const bytes = await consumeBytes(res)
    const ms = Date.now() - started
    const ok =
      args.expectStatus !== undefined
        ? res.status === args.expectStatus
        : res.status >= 200 && res.status < 300
    return { ms, ok, status: res.status, bytes }
  } catch {
    return { ms: Date.now() - started, ok: false, status: 0, bytes: 0 }
  } finally {
    clearTimeout(timer)
  }
}

function makeReservoir(max: number) {
  const lat: number[] = []
  let seen = 0
  const push = (v: number) => {
    seen++
    if (lat.length < max) {
      lat.push(v)
      return
    }
    const j = Math.floor(Math.random() * seen)
    if (j < max) lat[j] = v
  }
  return { lat, push }
}

async function runStage(opt: Options, stage: Stage): Promise<{
  stage: Stage
  total: number
  ok: number
  bytes: number
  statusCounts: Record<string, number>
  latSamples: number[]
}> {
  const endedAt = Date.now() + stage.durationSec * 1000
  const statusCounts: Record<string, number> = {}
  const reservoir = makeReservoir(opt.maxLatencySamples)
  let total = 0
  let ok = 0
  let bytes = 0
  let lastTotal = 0
  let lastOk = 0

  const printTimer = setInterval(() => {
    const curTotal = total
    const curOk = ok
    const rps = curTotal - lastTotal
    const okRps = curOk - lastOk
    lastTotal = curTotal
    lastOk = curOk
    const rate = curTotal === 0 ? 0 : (curOk / curTotal) * 100
    console.log(
      `[${stage.name}] t=${Math.max(0, Math.round((endedAt - Date.now()) / 1000))}s concurrency=${stage.concurrency} rps=${rps} okRps=${okRps} okRate=${rate.toFixed(2)}%`
    )
  }, 1000)

  const worker = async () => {
    while (Date.now() < endedAt) {
      const ep = chooseWeighted(opt.endpoints)
      const url = buildUrl(opt.baseUrl, ep.path, opt.vars)
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(ep.headers ?? {}),
      }
      if (opt.token) headers.Authorization = `Bearer ${opt.token}`
      const r = await requestOnce({
        method: ep.method,
        url,
        headers,
        body: ep.body,
        timeoutMs: opt.timeoutMs,
        expectStatus: ep.expectStatus,
      })
      total++
      bytes += r.bytes
      reservoir.push(r.ms)
      const k = String(r.status || 0)
      statusCounts[k] = (statusCounts[k] ?? 0) + 1
      if (r.ok) ok++
    }
  }

  const workers = Array.from({ length: Math.max(1, stage.concurrency) }, () => worker())
  await Promise.all(workers).finally(() => clearInterval(printTimer))

  return { stage, total, ok, bytes, statusCounts, latSamples: reservoir.lat }
}

function buildDefaultOptions(args: Record<string, string>): Options {
  const baseUrl = ensureSlash(args.baseUrl || process.env.API_BASE_URL || 'https://mrlweb.51webjs.com')
  const token = args.token || process.env.API_TOKEN || process.env.BEARER_TOKEN
  const timeoutMs = Number(args.timeoutMs || process.env.LOAD_TIMEOUT_MS || 8000)
  const maxLatencySamples = Number(args.maxLatencySamples || 200000)

  const vars: Record<string, string> = {
    ORDER_ID: args.orderId || process.env.ORDER_ID || '',
    REQUEST_ID: args.requestId || process.env.REQUEST_ID || '',
    AVATAR_ID: args.avatarId || process.env.AVATAR_ID || '',
  }

  const endpoints: Endpoint[] = [
    { id: 'health', method: 'GET', path: '/api/health', weight: 20, expectStatus: 200 },
    { id: 'hello', method: 'GET', path: '/api/hello', weight: 20, expectStatus: 200 },
    { id: 'auth_me', method: 'GET', path: '/api/auth/me', weight: 15, expectStatus: 200 },
    { id: 'order_open', method: 'GET', path: '/api/order/open?page=1&pageSize=20', weight: 15, expectStatus: 200 },
    { id: 'order_list', method: 'GET', path: '/api/order/list', weight: 10, expectStatus: 200 },
    { id: 'order_processing_status', method: 'GET', path: '/api/order-processing/status/{{ORDER_ID}}', weight: 10, expectStatus: 200 },
    { id: 'content_by_id', method: 'GET', path: '/api/content-generation/content/{{REQUEST_ID}}', weight: 5, expectStatus: 200 },
    { id: 'content_images', method: 'GET', path: '/api/content-generation/content-images/{{REQUEST_ID}}', weight: 5, expectStatus: 200 },
    {
      id: 'content_request_avatar',
      method: 'GET',
      path: '/api/content-generation/request/{{REQUEST_ID}}/avatar/{{AVATAR_ID}}',
      weight: 5,
      expectStatus: 200,
    },
  ]

  const maxConcurrency = Number(args.maxConcurrency || 500)
  const soakSec = Number(args.soakSec || 10 * 60)
  const stages: Stage[] = [
    { name: 'warmup', durationSec: 30, concurrency: Math.max(1, Math.round(maxConcurrency * 0.1)) },
    { name: 'ramp_30%', durationSec: 60, concurrency: Math.max(1, Math.round(maxConcurrency * 0.3)) },
    { name: 'ramp_60%', durationSec: 60, concurrency: Math.max(1, Math.round(maxConcurrency * 0.6)) },
    { name: 'peak', durationSec: 60, concurrency: maxConcurrency },
    { name: 'soak', durationSec: soakSec, concurrency: Math.max(1, Math.round(maxConcurrency * 0.6)) },
  ]

  return { baseUrl, timeoutMs, maxLatencySamples, token, vars, endpoints, stages }
}

function summarize(results: Awaited<ReturnType<typeof runStage>>[]) {
  const summary = results.map((r) => {
    const lat = [...r.latSamples].sort((a, b) => a - b)
    const p50 = percentile(lat, 50)
    const p90 = percentile(lat, 90)
    const p95 = percentile(lat, 95)
    const p99 = percentile(lat, 99)
    const okRate = r.total === 0 ? 0 : (r.ok / r.total) * 100
    const avgRps = r.total / Math.max(1, r.stage.durationSec)
    return {
      stage: r.stage.name,
      durationSec: r.stage.durationSec,
      concurrency: r.stage.concurrency,
      total: r.total,
      ok: r.ok,
      okRate: Number(okRate.toFixed(2)),
      avgRps: Number(avgRps.toFixed(2)),
      p50,
      p90,
      p95,
      p99,
      bytesMB: Number((r.bytes / 1024 / 1024).toFixed(2)),
      statusCounts: r.statusCounts,
    }
  })
  return summary
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const opt = buildDefaultOptions(args)

  if (!opt.token) {
    console.error('缺少 token：请传 --token 或设置 API_TOKEN/BEARER_TOKEN 环境变量（仅 /api/health、/api/hello、匿名内容接口会通过）')
  }

  if (!opt.vars.ORDER_ID || !opt.vars.REQUEST_ID || !opt.vars.AVATAR_ID) {
    console.error('缺少 ORDER_ID/REQUEST_ID/AVATAR_ID：请传 --orderId/--requestId/--avatarId 或设置同名环境变量（缺失会导致部分用例 4xx）')
  }

  console.log(`Load test start: baseUrl=${opt.baseUrl} stages=${opt.stages.map((s) => `${s.name}:${s.concurrency}x${s.durationSec}s`).join(',')}`)

  const stageResults: Awaited<ReturnType<typeof runStage>>[] = []
  for (const stage of opt.stages) {
    console.log('')
    console.log(`Stage: ${stage.name} concurrency=${stage.concurrency} duration=${stage.durationSec}s`)
    const r = await runStage(opt, stage)
    stageResults.push(r)
  }

  const report = summarize(stageResults)
  console.log('')
  console.log(JSON.stringify({ baseUrl: opt.baseUrl, report }, null, 2))
}

void main()

