import { ForbiddenException } from '@nestjs/common'
import { OrderProcessingController } from './order-processing.controller'
import { getMySQLClient } from '../../storage/database/mysql-client'

jest.mock('../../storage/database/mysql-client', () => ({
  getMySQLClient: jest.fn(),
}))

describe('OrderProcessingController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('ensureProcessingOwner backfills user_id and allows owner access', async () => {
    const db = {
      query: jest.fn().mockImplementation((sql: string) => {
        if (sql.includes('FROM orders')) {
          return Promise.resolve([{ user_id: 'user_1' }])
        }
        return Promise.resolve([])
      }),
    }
    ;(getMySQLClient as any).mockReturnValue(db)

    const processingService = {
      getProcessingStatus: jest.fn().mockResolvedValue({ id: 'req_1', order_id: 'order_1', user_id: '' }),
      getProcessingByRequestId: jest.fn().mockResolvedValue(null),
    }
    const controller = new OrderProcessingController(processingService as any, {} as any)

    const record = await (controller as any).ensureProcessingOwner('req_1', 'user_1', 'lite')
    expect(record.userId || record.user_id).toBe('user_1')

    const updateCall = (db.query as any).mock.calls.find((c: any[]) =>
      String(c[0]).includes('UPDATE content_generation_requests')
    )
    expect(updateCall).toBeTruthy()
  })

  test('ensureProcessingOwner rejects when order owner cannot be determined', async () => {
    const db = {
      query: jest.fn().mockResolvedValue([]),
    }
    ;(getMySQLClient as any).mockReturnValue(db)

    const processingService = {
      getProcessingStatus: jest.fn().mockResolvedValue({ id: 'req_1', order_id: 'order_1', user_id: '' }),
      getProcessingByRequestId: jest.fn().mockResolvedValue(null),
    }
    const controller = new OrderProcessingController(processingService as any, {} as any)

    await expect((controller as any).ensureProcessingOwner('req_1', 'user_1', 'lite')).rejects.toBeInstanceOf(ForbiddenException)
  })

  test('ensureProcessingOwner rejects non-owner access when user_id present', async () => {
    const processingService = {
      getProcessingStatus: jest.fn().mockResolvedValue({ id: 'req_1', order_id: 'order_1', user_id: 'user_1' }),
      getProcessingByRequestId: jest.fn().mockResolvedValue(null),
    }
    const controller = new OrderProcessingController(processingService as any, {} as any)

    await expect((controller as any).ensureProcessingOwner('req_1', 'user_2', 'lite')).rejects.toBeInstanceOf(ForbiddenException)
  })
})

