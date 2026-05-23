import fs from 'node:fs'
import path from 'node:path'

export type ApiTestReportMeta = {
  title: string
  baseUrl: string
  startedAt: string
  finishedAt: string
  total: number
  pass: number
  fail: number
  p50: number
  p90: number
  p95: number
  p99: number
  groups: Array<{ group: string; pass: number; fail: number }>
}

export type ApiTestCaseResult = {
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

export type ApiTestReport = {
  meta: ApiTestReportMeta
  results: ApiTestCaseResult[]
}

function escapeHtml(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function ensureDir(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

export function writeJsonReport(filePath: string, report: ApiTestReport): void {
  ensureDir(filePath)
  fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8')
}

export function writeHtmlReport(filePath: string, report: ApiTestReport): void {
  ensureDir(filePath)
  fs.writeFileSync(filePath, renderHtml(report), 'utf8')
}

export function renderHtml(report: ApiTestReport): string {
  const m = report.meta
  const rows = report.results
    .map((r, idx) => {
      const status = r.status === undefined ? '-' : String(r.status)
      const name = r.name ? ` ${r.name}` : ''
      const err = r.error ? escapeHtml(r.error) : ''
      const ok = r.ok ? 'PASS' : 'FAIL'
      const cls = r.ok ? 'ok' : 'bad'
      return `<tr class="${cls}">
  <td class="mono">${idx + 1}</td>
  <td class="mono">${escapeHtml(ok)}</td>
  <td class="mono">${escapeHtml(r.group)}</td>
  <td class="mono">${escapeHtml(r.id)}${name ? `<span class="muted">${escapeHtml(name)}</span>` : ''}</td>
  <td class="mono">${escapeHtml(r.method)}</td>
  <td class="mono">${escapeHtml(status)}</td>
  <td class="mono right">${r.ms}</td>
  <td class="err">${err}</td>
</tr>`
    })
    .join('\n')

  const groupRows = m.groups
    .map((g) => {
      const total = g.pass + g.fail
      return `<tr>
  <td class="mono">${escapeHtml(g.group)}</td>
  <td class="mono right">${total}</td>
  <td class="mono right ok">${g.pass}</td>
  <td class="mono right bad">${g.fail}</td>
</tr>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(m.title)}</title>
    <style>
      :root { color-scheme: light; }
      body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"; margin: 0; color: #0f172a; background: #f8fafc; }
      .wrap { max-width: 1200px; margin: 0 auto; padding: 20px; }
      .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; }
      h1 { font-size: 20px; margin: 0 0 12px; }
      h2 { font-size: 16px; margin: 0 0 10px; }
      .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
      .kv { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px; background: #fff; }
      .k { font-size: 12px; color: #64748b; }
      .v { font-size: 14px; font-weight: 600; margin-top: 6px; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 12px; }
      .muted { color: #64748b; margin-left: 6px; }
      .ok { color: #16a34a; }
      .bad { color: #dc2626; }
      table { width: 100%; border-collapse: collapse; }
      th, td { border-bottom: 1px solid #e2e8f0; padding: 8px; vertical-align: top; }
      th { background: #f1f5f9; text-align: left; font-size: 12px; color: #334155; position: sticky; top: 0; }
      .right { text-align: right; }
      .err { white-space: pre-wrap; word-break: break-word; font-size: 12px; color: #0f172a; }
      .section { margin-top: 12px; }
      .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; border: 1px solid #e2e8f0; background: #fff; font-size: 12px; margin-right: 6px; }
      .pill.ok { border-color: rgba(22,163,74,.3); background: rgba(22,163,74,.06); }
      .pill.bad { border-color: rgba(220,38,38,.3); background: rgba(220,38,38,.06); }
      .footer { margin-top: 14px; font-size: 12px; color: #64748b; }
      @media (max-width: 900px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <h1>${escapeHtml(m.title)}</h1>
        <div class="mono muted">baseUrl=${escapeHtml(m.baseUrl)} · startedAt=${escapeHtml(m.startedAt)} · finishedAt=${escapeHtml(m.finishedAt)}</div>
        <div class="section">
          <span class="pill ${m.fail === 0 ? 'ok' : 'bad'}">PASS ${m.pass}</span>
          <span class="pill ${m.fail === 0 ? 'ok' : 'bad'}">FAIL ${m.fail}</span>
          <span class="pill">TOTAL ${m.total}</span>
          <span class="pill">p50 ${m.p50}ms</span>
          <span class="pill">p90 ${m.p90}ms</span>
          <span class="pill">p95 ${m.p95}ms</span>
          <span class="pill">p99 ${m.p99}ms</span>
        </div>
        <div class="section">
          <h2>分组统计</h2>
          <table>
            <thead>
              <tr>
                <th>group</th>
                <th class="right">total</th>
                <th class="right">pass</th>
                <th class="right">fail</th>
              </tr>
            </thead>
            <tbody>
              ${groupRows || '<tr><td colspan="4" class="muted">无</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="section">
          <h2>用例明细</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>result</th>
                <th>group</th>
                <th>id</th>
                <th>method</th>
                <th>status</th>
                <th class="right">ms</th>
                <th>error</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
        <div class="footer">Generated by api-tests</div>
      </div>
    </div>
  </body>
</html>`
}
