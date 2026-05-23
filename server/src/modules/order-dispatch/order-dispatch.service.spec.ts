import { OrderDispatchService } from './order-dispatch.service'
import { getMySQLClient } from '../../storage/database/mysql-client'

jest.mock('../../storage/database/mysql-client', () => ({
  getMySQLClient: jest.fn(),
  getPool: jest.fn(),
}))

describe('OrderDispatchService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('startContentGeneration returns first platform requestId when generation starts', async () => {
    const service = new OrderDispatchService({} as any, {} as any, {} as any, {} as any, {} as any)
    jest.spyOn(service as any, '_doStartContentGeneration').mockResolvedValue([{ platform: 'wechat', requestId: 'req_1' }])

    const result = await service.startContentGeneration('order_1', 'avatar_1', {})
    expect(result.requestId).toBe('req_1')
  })

  test('startContentGeneration fallback inserts failed record via upsert when retries exhausted', async () => {
    const db = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.startsWith('SELECT user_id, platforms, content_type FROM orders')) {
          return Promise.resolve([{ user_id: 'user_1', platforms: '["general"]', content_type: 'image_text' }])
        }
        return Promise.resolve({ affectedRows: 1 })
      }),
    }
    ;(getMySQLClient as any).mockReturnValue(db)

    const service = new OrderDispatchService({} as any, {} as any, {} as any, {} as any, {} as any)
    jest.spyOn(service as any, '_doStartContentGeneration').mockRejectedValue(new Error('boom'))

    const p = service.startContentGeneration('order_1', 'avatar_1', {})
    await Promise.resolve()
    await jest.runAllTimersAsync()
    const result = await p

    const insertCall = (db.query as any).mock.calls.find((c: any[]) =>
      String(c[0]).includes('INSERT INTO content_generation_requests')
    )
    expect(insertCall).toBeTruthy()
    expect(String(insertCall[0])).toContain('ON DUPLICATE KEY UPDATE')
    expect(result.requestId).toBeTruthy()
  })
})
