import { Injectable } from '@nestjs/common'
import { getSupabaseClient } from '../../storage/database/supabase-client'

export interface CreateResultDto {
  order_id: string
  avatar_id: string
  exposure: number
  likes: number
  comments?: number
  shares?: number
  link_url?: string
  description?: string
}

@Injectable()
export class OrderResultsService {
  /**
   * 创建订单效果结果
   */
  async createResult(dto: CreateResultDto) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('order_results')
      .insert({
        ...dto,
        submitted_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      throw new Error('提交效果数据失败: ' + error.message)
    }

    return data
  }

  /**
   * 获取订单的效果结果
   */
  async getOrderResults(orderId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('order_results')
      .select(`
        *,
        avatars (
          id,
          name,
          avatar_url
        )
      `)
      .eq('order_id', orderId)

    if (error) {
      throw new Error('获取效果数据失败: ' + error.message)
    }

    return data
  }

  /**
   * 获取分身的所有效果结果
   */
  async getAvatarResults(avatarId: string) {
    const client = getSupabaseClient()

    const { data, error } = await client
      .from('order_results')
      .select('*')
      .eq('avatar_id', avatarId)
      .order('submitted_at', { ascending: false })

    if (error) {
      throw new Error('获取分身效果数据失败: ' + error.message)
    }

    return data
  }
}
