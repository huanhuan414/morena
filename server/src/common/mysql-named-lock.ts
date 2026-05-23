import { Logger } from '@nestjs/common'
import { getPool } from '../storage/database/mysql-client'

export async function withMysqlNamedLock<T>(
  lockName: string,
  fn: () => Promise<T>,
  options?: { logger?: Logger; waitSeconds?: number }
): Promise<{ acquired: boolean; result?: T }> {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    const waitSeconds = Number(options?.waitSeconds ?? 0)
    const [rows] = (await conn.query('SELECT GET_LOCK(?, ?) AS acquired', [
      lockName,
      waitSeconds,
    ])) as any[]
    const acquired = Boolean(rows?.[0]?.acquired)

    if (!acquired) {
      options?.logger?.debug?.(`[MysqlLock] skip: ${lockName}`)
      return { acquired: false }
    }

    options?.logger?.debug?.(`[MysqlLock] acquired: ${lockName}`)
    const result = await fn()
    return { acquired: true, result }
  } finally {
    try {
      await conn.query('DO RELEASE_LOCK(?)', [lockName])
    } catch {}
    conn.release()
  }
}
