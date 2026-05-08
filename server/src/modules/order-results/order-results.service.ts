// @ts-nocheck
import { Injectable } from '@nestjs/common'
import { getMySQLClient } from '../../storage/database/mysql-client'

@Injectable()
export class OrderResultsService {
  async createOrderResult(data: {
    order_id: string
    avatar_id: string
    user_id: string
    result: Record<string, any>
  }) {
    const db = getMySQLClient()
    
    const id = crypto.randomUUID()
    await db.insert('order_results', {
      id,
      order_id: data.order_id,
      avatar_id: data.avatar_id,
      user_id: data.user_id,
      result: JSON.stringify(data.result),
      created_at: new Date(),
      updated_at: new Date()
    })
    
    return { id }
  }

  async getOrderResult(orderId: string) {
    const db = getMySQLClient()
    return await db.queryOne('order_results', { order_id: orderId }) as any
  }

  async getOrderResults(userId: string) {
    const db = getMySQLClient()
    return await db.query('order_results', { user_id: userId }) as any
  }
}

import * as crypto from 'crypto'
