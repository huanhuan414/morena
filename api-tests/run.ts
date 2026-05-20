import fs from 'node:fs'

import dotenv from 'dotenv'

dotenv.config({ path: fs.existsSync('.env.local') ? '.env.local' : '.env' })

import { config } from './config'
import type { ApiTestConfig, AssertType, EndpointDef } from './config'

type RunOptions = {
  groups?: string[]
  ids?: string[]
  concurrency?: number
  timeoutMs?: number
  failFast?: boolean
}

type Ctx = {
  baseUrl: string
  defaultHeaders: Record<string, string>
  timeoutMs: number
  token?: string
  vars: Record<string, string>
}

type CaseResult = {
  id: string
  group: string
  name?: string
  method: string
  url: string
  ok: boolean
  status?: number
  ms: number
  error?: string
}

function parseArgs(argv: string[]): RunOptions {
  const opt: RunOptions = {}
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--group' || a === '-g') opt.groups = (argv[++i] ?? '').split(',').filter(Boolean)
    else if (a === '--id') opt.ids = (argv[++i] ?? '').split(',').filter(Boolean)
    else if (a === '--concurrency' || a === '-c') opt.concurrency = Number(argv[++i])
    else if (a === '--timeout') opt.timeoutMs = Number(argv[++i])
    else if (a === '--fail-fast') opt.failFast = true
  }
  return opt
}

function ensureSlash(baseUrl: string): string {
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))]
}

function toRecord(headers?: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  if (!headers) return out
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === 'string' && v.length > 0) out[k] = v
  }
  return out
}

function deepTemplate(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string') return templateStr(value, vars)
  if (Array.isArray(value)) return value.map((v) => deepTemplate(v, vars))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deepTemplate(v, vars)
    }
    return out
  }
  return value
}

function templateStr(input: string, vars: Record<string, string>): string {
  return input.replace(/\{\{([a-zA-Z0-9_.$-]+)\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim()
    return vars[key] ?? process.env[key] ?? ''
  })
}

function jsonGet(obj: unknown, path: string): unknown {
  const parts = path.split('.').filter(Boolean)
  let cur: any = obj
  for (const p of parts) {
    if (cur == null) return undefined
    cur = cur[p]
  }
  return cur
}

function buildUrl(baseUrl: string, ep: EndpointDef, vars: Record<string, string>): string {
  const path = templateStr(ep.path, vars).replace(/:([a-zA-Z0-9_]+)/g, (_, key: string) => {
    const v = vars[key] ?? process.env[key]
    return v && v.length > 0 ? v : 'test'
  })
  const url = new URL(ensureSlash(baseUrl) + path)
  if (ep.query) {
    for (const [k, v] of Object.entries(ep.query)) {
      if (v === undefined) continue
      url.searchParams.set(k, String(v))
    }
  }
  return url.toString()
}

function formatCurl(method: string, url: string, headers: Record<string, string>, body?: unknown): string {
  const headerPart = Object.entries(headers)
    .map(([k, v]) => `-H ${JSON.stringify(`${k}: ${v}`)}`)
    .join(' ')
  const bodyPart = body === undefined ? '' : `--data ${JSON.stringify(JSON.stringify(body))}`
  return `curl -i -X ${method} ${headerPart} ${bodyPart} ${JSON.stringify(url)}`
}

async function requestJson(args: {
  method: string
  url: string
  headers: Record<string, string>
  body?: unknown
  timeoutMs: number
}): Promise<{ status: number; headers: Headers; json: unknown; text: string; ms: number }> {
  const controller = new AbortController()
  const started = Date.now()
  const timer = setTimeout(() => controller.abort(new Error('timeout')), args.timeoutMs)
  try {
    const res = await fetch(args.url, {
      method: args.method,
      headers: args.headers,
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      signal: controller.signal
    })
    const text = await res.text()
    let json: unknown = undefined
    try {
      json = text.length > 0 ? JSON.parse(text) : undefined
    } catch {
      json = undefined
    }
    return { status: res.status, headers: res.headers, json, text, ms: Date.now() - started }
  } finally {
    clearTimeout(timer)
  }
}

function assertOne(a: AssertType, r: { status: number; json: unknown; ms: number }): string | null {
  if (a.type === 'status') {
    if (r.status !== a.equals) return `status 期望 ${a.equals}，实际 ${r.status}`
    return null
  }
  if (a.type === 'statusLt') {
    if (r.status >= a.lt) return `status 期望 < ${a.lt}，实际 ${r.status}`
    return null
  }
  if (a.type === 'maxMs') {
    if (r.ms > a.lte) return `耗时 ${r.ms}ms 超过阈值 ${a.lte}ms`
    return null
  }
  if (a.type === 'jsonPath') {
    const v = jsonGet(r.json, a.path)
    if (a.exists === true && v === undefined) return `jsonPath ${a.path} 不存在`
    if (a.exists === false && v !== undefined) return `jsonPath ${a.path} 不应存在`
    if (Object.prototype.hasOwnProperty.call(a, 'equals') && v !== a.equals) {
      return `jsonPath ${a.path} 期望等于 ${JSON.stringify(a.equals)}，实际 ${JSON.stringify(v)}`
    }
    if (a.oneOf && !a.oneOf.some((x) => Object.is(x, v))) {
      return `jsonPath ${a.path} 期望为 oneOf=${JSON.stringify(a.oneOf)}，实际 ${JSON.stringify(v)}`
    }
    if (a.typeof) {
      const t = v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v
      if (t !== a.typeof) return `jsonPath ${a.path} 期望类型 ${a.typeof}，实际 ${t}`
    }
    return null
  }
  const _exhaustive: never = a
  void _exhaustive
  return '未知断言类型'
}

async function resolveAuth(cfg: ApiTestConfig, ctx: Ctx): Promise<void> {
  if (cfg.auth.type === 'none') return

  if (cfg.auth.type === 'bearer') {
    const raw = process.env[cfg.auth.tokenEnv] ?? ''
    if (!raw) throw new Error(`缺少环境变量 ${cfg.auth.tokenEnv}，无法鉴权`)
    ctx.token = raw
    return
  }

  const url = buildUrl(cfg.baseUrl, { id: 'auth', group: 'auth', method: cfg.auth.method, path: cfg.auth.path }, ctx.vars)
  const headers: Record<string, string> = {
    ...ctx.defaultHeaders,
    ...toRecord(cfg.auth.headers)
  }
  const body = cfg.auth.body === undefined ? undefined : deepTemplate(cfg.auth.body, ctx.vars)
  const res = await requestJson({
    method: cfg.auth.method,
    url,
    headers,
    body,
    timeoutMs: cfg.auth.timeoutMs ?? ctx.timeoutMs
  })
  const token = jsonGet(res.json, cfg.auth.extractTokenPath)
  if (typeof token !== 'string' || token.length === 0) {
    throw new Error(
      `登录未获取到 token：extractTokenPath=${cfg.auth.extractTokenPath}，status=${res.status}，body=${res.text.slice(0, 500)}`
    )
  }
  ctx.token = token
}

function applyAuthHeader(cfg: ApiTestConfig, ctx: Ctx, headers: Record<string, string>): void {
  if (!ctx.token) return
  if (cfg.auth.type === 'none') return

  const headerName = cfg.auth.type === 'bearer' ? cfg.auth.headerName ?? 'Authorization' : cfg.auth.headerName ?? 'Authorization'
  const prefix = cfg.auth.type === 'bearer' ? cfg.auth.prefix ?? 'Bearer ' : cfg.auth.prefix ?? 'Bearer '
  headers[headerName] = `${prefix}${ctx.token}`
}

function topoSort(endpoints: EndpointDef[]): EndpointDef[] {
  const byId = new Map(endpoints.map((e) => [e.id, e]))
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const out: EndpointDef[] = []

  const dfs = (id: string) => {
    if (visited.has(id)) return
    if (visiting.has(id)) throw new Error(`dependsOn 存在循环依赖：${id}`)
    visiting.add(id)
    const ep = byId.get(id)
    if (!ep) throw new Error(`dependsOn 引用了不存在的用例 id：${id}`)
    for (const dep of ep.dependsOn ?? []) dfs(dep)
    visiting.delete(id)
    visited.add(id)
    out.push(ep)
  }

  for (const e of endpoints) dfs(e.id)
  return out
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  const q = [...items]
  const workers: Promise<void>[] = []
  const runOne = async () => {
    while (q.length > 0) {
      const item = q.shift()
      if (!item) return
      await fn(item)
    }
  }
  for (let i = 0; i < Math.max(1, concurrency); i++) workers.push(runOne())
  await Promise.all(workers)
}

async function runOneCase(cfg: ApiTestConfig, ctx: Ctx, ep: EndpointDef): Promise<CaseResult> {
  const url = buildUrl(cfg.baseUrl, ep, ctx.vars)
  const headers: Record<string, string> = {
    ...ctx.defaultHeaders,
    ...toRecord(cfg.defaultHeaders),
    ...toRecord(ep.headers)
  }

  const shouldAuth = ep.auth !== false
  if (shouldAuth) applyAuthHeader(cfg, ctx, headers)

  const body = ep.body === undefined ? undefined : deepTemplate(ep.body, ctx.vars)
  const started = Date.now()
  try {
    const res = await requestJson({
      method: ep.method,
      url,
      headers,
      body,
      timeoutMs: ctx.timeoutMs
    })
    const ms = res.ms
    const asserts: AssertType[] = ep.asserts?.length ? ep.asserts : [{ type: 'statusLt', lt: 500 }]
    const errors: string[] = []
    for (const a of asserts) {
      const err = assertOne(a, { status: res.status, json: res.json, ms })
      if (err) errors.push(err)
    }

    if (errors.length === 0 && ep.save?.length) {
      for (const s of ep.save) {
        const v = jsonGet(res.json, s.fromJsonPath)
        if (v !== undefined && v !== null) ctx.vars[s.toVar] = String(v)
      }
      if (ctx.vars.token && !ctx.token) ctx.token = ctx.vars.token
    }

    return {
      id: ep.id,
      group: ep.group,
      name: ep.name,
      method: ep.method,
      url,
      ok: errors.length === 0,
      status: res.status,
      ms,
      error:
        errors.length === 0
          ? undefined
          : `${errors.join('; ')} | curl=${formatCurl(ep.method, url, headers, body)} | body=${res.text.slice(0, 800)}`
    }
  } catch (e: any) {
    return {
      id: ep.id,
      group: ep.group,
      name: ep.name,
      method: ep.method,
      url,
      ok: false,
      ms: Date.now() - started,
      error: `${e?.name ?? 'Error'}: ${e?.message ?? String(e)} | curl=${formatCurl(ep.method, url, headers, body)}`
    }
  }
}

function formatLine(r: CaseResult): string {
  const mark = r.ok ? 'PASS' : 'FAIL'
  const status = r.status === undefined ? '-' : String(r.status)
  const name = r.name ? ` (${r.name})` : ''
  const ms = String(r.ms).padStart(5, ' ')
  return `${mark}  ${ms}ms  ${status.padStart(3, ' ')}  ${r.group.padEnd(10, ' ')}  ${r.id}${name}`
}

async function main(): Promise<void> {
  const opt = parseArgs(process.argv.slice(2))

  const cfg: ApiTestConfig = {
    ...config,
    baseUrl: ensureSlash(process.env.API_BASE_URL ?? config.baseUrl),
    timeoutMs: opt.timeoutMs ?? config.timeoutMs,
    concurrency: opt.concurrency ?? config.concurrency
  }

  const ctx: Ctx = {
    baseUrl: cfg.baseUrl,
    defaultHeaders: toRecord(cfg.defaultHeaders),
    timeoutMs: cfg.timeoutMs,
    vars: {
      BASE_URL: cfg.baseUrl
    }
  }

  await resolveAuth(cfg, ctx)

  let endpoints = cfg.endpoints
  if (opt.groups?.length) endpoints = endpoints.filter((e) => opt.groups!.includes(e.group))
  if (opt.ids?.length) endpoints = endpoints.filter((e) => opt.ids!.includes(e.id))

  if (endpoints.length === 0) {
    console.error('没有匹配到任何用例：请检查 endpoints / --group / --id')
    process.exitCode = 2
    return
  }

  endpoints = topoSort(endpoints)

  const results: CaseResult[] = []
  let failed = 0

  console.log(`API 测试开始：baseUrl=${cfg.baseUrl}  用例数=${endpoints.length}  并发=${cfg.concurrency}  超时=${cfg.timeoutMs}ms`)

  await runPool(endpoints, cfg.concurrency, async (ep) => {
    const r = await runOneCase(cfg, ctx, ep)
    results.push(r)
    if (!r.ok) failed++
    console.log(formatLine(r))
    if (!r.ok && opt.failFast) throw new Error(`fail-fast: ${ep.id}`)
  }).catch((e) => {
    if (opt.failFast) console.error(String(e?.message ?? e))
  })

  const okCount = results.filter((r) => r.ok).length
  const lat = results.map((r) => r.ms).sort((a, b) => a - b)
  const p50 = percentile(lat, 50)
  const p90 = percentile(lat, 90)
  const p95 = percentile(lat, 95)
  const p99 = percentile(lat, 99)

  const byGroup = new Map<string, { pass: number; fail: number }>()
  for (const r of results) {
    const cur = byGroup.get(r.group) ?? { pass: 0, fail: 0 }
    if (r.ok) cur.pass++
    else cur.fail++
    byGroup.set(r.group, cur)
  }

  console.log('')
  console.log('汇总：')
  console.log(`- 结果：PASS ${okCount} / FAIL ${failed} / TOTAL ${results.length}`)
  console.log(`- 耗时分位：p50=${p50}ms p90=${p90}ms p95=${p95}ms p99=${p99}ms`)
  console.log(`- 分组统计：${[...byGroup.entries()].map(([g, s]) => `${g}(P${s.pass}/F${s.fail})`).join('  ')}`)

  if (failed > 0) {
    console.log('')
    console.log('失败详情（前 20 条）：')
    for (const r of results.filter((x) => !x.ok).slice(0, 20)) {
      console.log(`- ${r.id}: ${r.error}`)
    }
  }

  process.exitCode = failed > 0 ? 1 : 0
}

void main()
