import { execSync } from 'node:child_process'

function run(cmd: string, env?: NodeJS.ProcessEnv): void {
  execSync(cmd, {
    stdio: 'inherit',
    env: { ...process.env, ...env }
  })
}

function main(): void {
  const keepDocker = process.env.KEEP_DOCKER === '1'
  try {
    run('pnpm validate')
    run('pnpm test:unit')

    run('pnpm docker:local')
    run('pnpm exec tsx scripts/wait-for-http.ts', {
      WAIT_URL: 'http://127.0.0.1:3000/api/health',
      WAIT_TIMEOUT_MS: '60000',
      WAIT_INTERVAL_MS: '800'
    })

    run('pnpm exec tsx api-tests/run.ts --group smoke,auth-negative,order-processing-negative,upload-smoke,payment-smoke,payment-negative,core-chain --fail-fast', {
      API_BASE_URL: 'http://127.0.0.1:3000',
      API_CONCURRENCY: process.env.API_CONCURRENCY ?? '6',
      API_TEST_PHONE: process.env.API_TEST_PHONE ?? '18800000000',
      API_ENABLE_DEV_LOGIN: process.env.API_ENABLE_DEV_LOGIN ?? '1'
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
