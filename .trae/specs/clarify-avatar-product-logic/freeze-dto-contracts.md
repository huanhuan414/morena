# A-4 冻结 DTO 契约

## 1. 订单详情 DTO

```ts
interface OrderDetailDto {
  id: string
  title: string
  description: string
  contentType: string
  platforms: string[]
  requirements: Record<string, any>
  budget: number
  status: string
  avatarCount: number
  avatarStats: AvatarOrderStatDto[]
  summary_stats: {
    totalAvatars: number
    acceptedAvatars: number
    completedAvatars: number
    totalPublished: number
    avatarStats: AvatarOrderStatDto[]
  }
  createdAt: string
}
```

## 2. AvatarOrderStat DTO

```ts
interface AvatarOrderStatDto {
  id: string
  requestId: string
  avatarId: string
  avatarName: string
  nickname: string
  avatarUrl: string
  platform: string
  status: 'pending' | 'accepted' | 'generating' | 'preview' | 'publishing' | 'published' | 'awaiting_acceptance' | 'completed' | 'failed' | 'declined'
  publishFeedback: Record<string, any>
  createdAt: string
}
```

## 3. 处理状态 DTO

```ts
interface OrderProcessingStatusDto {
  id: string
  requestId: string
  orderId: string
  avatarId: string
  userId?: string
  rawStatus: string
  status: 'queuing' | 'generating' | 'preview' | 'publishing' | 'published' | 'awaiting_acceptance' | 'completed' | 'failed'
  contentType: string
  generatedContent: {
    title: string
    content: string
    images: string[]
    videos: string[]
    platform: string
    platforms: string[]
  }
  publishStatus: {
    platforms: string[]
    platformStatus: Record<string, { status: 'manual' | 'success' | 'failed'; message?: string }>
  }
  publishFeedback: Record<string, PublishFeedbackItemDto>
  created_at: string
  updated_at: string
}
```

## 4. 发布反馈 DTO

```ts
interface PublishFeedbackItemDto {
  link?: string
  images?: string[]
  submitTime?: string
  operator?: string
  metrics?: {
    views?: number
    likes?: number
    comments?: number
    shares?: number
  }
}
```

## 5. 接单结果 DTO

```ts
interface AcceptOrderResultDto {
  success: true
  orderId: string
  avatarId: string
  dispatchId: string
  requestId: string
}
```

## 6. 验收 DTO

```ts
interface AcceptanceActionDto {
  requestId: string
  orderId: string
  action: 'accept' | 'revision'
  feedback?: {
    rejectReason?: string
  }
}
```

## 7. 强制规则

- 前端禁止再根据接口缺字段自行猜测业务状态
- 后端返回结构必须优先满足上述 DTO
- 页面跳转至少传 `orderId`，进入处理链时优先同时传 `requestId` 和 `avatarId`
