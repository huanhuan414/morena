import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

function run(cmd: string, env?: NodeJS.ProcessEnv): void {
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
}

function ensureWebDist(): void {
  const root = process.cwd()
  const distDir = path.join(root, '.docker-dist-web')
  const indexHtml = path.join(distDir, 'index.html')
  if (fs.existsSync(indexHtml)) return

  const tarFile = path.join(root, 'dist-web.tar.gz')
  if (!fs.existsSync(tarFile)) {
    throw new Error('missing dist-web.tar.gz, please run pnpm build:web first')
  }

  fs.rmSync(distDir, { recursive: true, force: true })
  fs.mkdirSync(distDir, { recursive: true })
  run(`tar -xzf ${JSON.stringify(tarFile)} -C ${JSON.stringify(distDir)}`)
}

function main(): void {
  const keepDocker = process.env.KEEP_DOCKER === '1'
  try {
    run('pnpm validate')
    run('pnpm test:unit')
    run('pnpm build:server')
    ensureWebDist()

    run('pnpm docker:local')
    run('pnpm exec tsx scripts/wait-for-http.ts', {
      WAIT_URL: 'http://127.0.0.1:3000/api/health',
      WAIT_TIMEOUT_MS: '60000',
      WAIT_INTERVAL_MS: '800'
    })

    run('pnpm exec tsx api-tests/run.ts --group smoke,auth-negative,order-processing-negative --concurrency 1 --fail-fast', {
      API_BASE_URL: 'http://127.0.0.1:3000',
      API_CONCURRENCY: '1'
    })
  } finally {
    if (!keepDocker) {
      try {
        run('pnpm docker:local:down')
      } catch {}
    }
  }
}

main()
