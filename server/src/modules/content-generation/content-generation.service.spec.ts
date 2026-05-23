import { ContentGenerationService } from './content-generation.service'
import { getMySQLClient } from '../../storage/database/mysql-client'
import { setCache } from '../../common/shared-cache'

jest.mock('../../storage/database/mysql-client', () => ({
  getMySQLClient: jest.fn(),
  getPool: jest.fn(),
}))

jest.mock('../../common/mysql-named-lock', () => ({
  withMysqlNamedLock: async (_name: string, fn: () => Promise<void>) => {
    await fn()
    return { acquired: true }
  },
}))

jest.mock('../../common/shared-cache', () => ({
  setCache: jest.fn(),
  getCache: jest.fn(),
}))

function createService() {
  const service = new ContentGenerationService({} as any, {} as any, {} as any)
  ;(service as any).executeGeneration = jest.fn().mockResolvedValue(undefined)
  return service
}

describe('ContentGenerationService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('generateContent writes user_id on insert', async () => {
    const db = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT user_id FROM orders')) {
          return Promise.resolve([{ userId: 'user_1' }])
        }
        return Promise.resolve([])
      }),
      insert: jest.fn().mockResolvedValue({ data: { affectedRows: 1 }, error: null }),
    }
    ;(getMySQLClient as any).mockReturnValue(db)

    const service = createService()
    await service.generateContent({
      orderId: 'order_1',
      avatarId: 'avatar_1',
      orderTitle: 't',
      orderDescription: 'd',
      platforms: ['wechat'],
      contentType: 'image_text',
      targetAudience: 'ta',
      contentQuantity: 1,
    })

    expect(db.insert).toHaveBeenCalledTimes(1)
    const [, insertPayload] = (db.insert as any).mock.calls[0]
    expect(insertPayload.user_id).toBe('user_1')
  })

  test('generateContent with requestId inserts record when update affects 0 rows', async () => {
    const db = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('SELECT user_id FROM orders')) {
          return Promise.resolve([{ userId: 'user_1' }])
        }
        if (sql.trimStart().startsWith('UPDATE content_generation_requests')) {
          return Promise.resolve({ affectedRows: 0 })
        }
        if (sql.trimStart().startsWith('INSERT INTO content_generation_requests')) {
          return Promise.resolve({ affectedRows: 1 })
        }
        return Promise.resolve([])
      }),
      insert: jest.fn(),
      update: jest.fn(),
    }
    ;(getMySQLClient as any).mockReturnValue(db)

    const service = createService()
    await service.generateContent({
      orderId: 'order_1',
      avatarId: 'avatar_1',
      orderTitle: 't',
      orderDescription: 'd',
      platforms: ['wechat'],
      contentType: 'image_text',
      targetAudience: 'ta',
      contentQuantity: 2,
      requestId: 'req_1',
    })

    const calls = (db.query as any).mock.calls.map((c: any[]) => String(c[0]))
    expect(calls.some((sql: string) => sql.trimStart().startsWith('INSERT INTO content_generation_requests'))).toBe(true)
  })

  test('recoverStuckGenerations uses SQL filtering and excludes generating_video', async () => {
    const db = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.trimStart().startsWith('SELECT id, status FROM content_generation_requests')) {
          return Promise.resolve([{ id: 'req_1', status: 'processing' }])
        }
        return Promise.resolve([])
      }),
      update: jest.fn().mockResolvedValue({ data: { affectedRows: 1 }, error: null }),
    }
    ;(getMySQLClient as any).mockReturnValue(db)

    const service = createService()
    await (service as any).recoverStuckGenerations()

    const sql = String((db.query as any).mock.calls[0][0])
    expect(sql).toContain('status IN')
    expect(sql).not.toContain('generating_video')
    expect(db.update).toHaveBeenCalledTimes(1)
    expect(setCache).toHaveBeenCalledWith('req_1', null)
  })
})
