// @ts-nocheck
export interface SubscriptionPlan {
  id: string
  name: string
  description: string
  price: number
  duration_days: number
  max_avatars: number
  can_receive_orders: boolean
  order_priority: number
  features: Record<string, any>
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  start_date: string
  end_date: string
  status: 'active' | 'expired' | 'cancelled'
  payment_id: string | null
  payment_method: string | null
  auto_renew: boolean
  created_at: string
  updated_at: string
  plan?: SubscriptionPlan
}

export interface AvatarSubscription {
  id: string
  user_id: string
  avatar_id: string
  subscription_id: string | null
  subscription_level: 'free' | 'basic' | 'premium' | 'vip'
  can_receive_orders: boolean
  order_priority: number
  is_active: boolean
  created_at: string
  updated_at: string
}
