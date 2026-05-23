import { regressionEndpoints } from './suites/regression'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type AssertType =
  | {
      type: 'status'
      equals: number
    }
  | {
      type: 'statusLt'
      lt: number
    }
  | {
      type: 'maxMs'
      lte: number
    }
  | {
      type: 'jsonPath'
      path: string
      exists?: boolean
      equals?: unknown
      oneOf?: unknown[]
      typeof?: 'string' | 'number' | 'boolean' | 'object' | 'array' | 'null'
    }

export type SaveVarRule = {
  fromJsonPath: string
  toVar: string
}

export type EndpointDef = {
  id: string
  group: string
  name?: string
  method: HttpMethod
  path: string
  query?: Record<string, string | number | boolean | undefined>
  headers?: Record<string, string | undefined>
  body?: unknown
  formData?: Record<
    string,
    | string
    | {
        filename: string
        contentType?: string
        base64: string
      }
  >
  auth?: boolean
  asserts?: AssertType[]
  save?: SaveVarRule[]
  dependsOn?: string[]
}

export type AuthConfig =
  | {
      type: 'none'
    }
  | {
      type: 'bearer'
      tokenEnv: string
      headerName?: string
      prefix?: string
    }
  | {
      type: 'login'
      method: HttpMethod
      path: string
      body?: unknown
      headers?: Record<string, string | undefined>
      extractTokenPath: string
      headerName?: string
      prefix?: string
      timeoutMs?: number
    }
  | {
      type: 'loginFlow'
      localOnly?: boolean
      localOnlyMessage?: string
      steps: {
        method: HttpMethod
        path: string
        body?: unknown
        headers?: Record<string, string | undefined>
        extractVars?: SaveVarRule[]
        timeoutMs?: number
      }[]
      extractTokenPath: string
      headerName?: string
      prefix?: string
      timeoutMs?: number
    }

export type ApiTestConfig = {
  baseUrl: string
  timeoutMs: number
  concurrency: number
  defaultHeaders?: Record<string, string | undefined>
  auth: AuthConfig
  endpoints: EndpointDef[]
}

const makeEndpoint = (method: HttpMethod, path: string): EndpointDef => {
  const seg = path.split('/').filter(Boolean)
  const group = seg[1] ?? 'root'
  return { id: `${method} ${path}`, group, method, path }
}

const resolvedBaseUrl = process.env.API_BASE_URL ?? 'https://mrlweb.51webjs.com'
const resolvedIsLocal = /^(https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(resolvedBaseUrl)

export const config: ApiTestConfig = {
  baseUrl: resolvedBaseUrl,
  timeoutMs: Number(process.env.API_TIMEOUT_MS ?? 15_000),
  concurrency: Number(process.env.API_CONCURRENCY ?? 6),
  defaultHeaders: {
    Accept: 'application/json',
    'Content-Type': 'application/json'
  },
  auth:
    process.env.API_TOKEN && process.env.API_TOKEN.length > 0
      ? {
          type: 'bearer',
          tokenEnv: 'API_TOKEN',
          headerName: 'Authorization',
          prefix: 'Bearer '
        }
      : resolvedIsLocal || process.env.API_ENABLE_DEV_LOGIN === '1'
        ? {
            type: 'loginFlow',
            steps: [
              {
                method: 'POST',
                path: '/api/auth/send-code',
                body: { phone: process.env.API_TEST_PHONE ?? '18800000000' },
                extractVars: [{ fromJsonPath: 'data.code', toVar: 'loginCode' }]
              },
              {
                method: 'POST',
                path: '/api/auth/phone-login',
                body: {
                  phone: process.env.API_TEST_PHONE ?? '18800000000',
                  code: '{{loginCode}}',
                  nickname: 'api-tests'
                },
                extractVars: [{ fromJsonPath: 'data.token', toVar: 'token' }]
              }
            ],
            extractTokenPath: 'data.token',
            localOnly: true,
            localOnlyMessage: 'loginFlow 默认仅允许本地执行；如需在非本地环境使用，请先评估短信/账号风险并调整开关'
          }
      : {
          type: 'none'
        },
  endpoints: [
    ...regressionEndpoints,

    makeEndpoint('GET', '/api/hello'),
    makeEndpoint('GET', '/api/health'),

    makeEndpoint('POST', '/api/auth/send-code'),
    makeEndpoint('POST', '/api/auth/phone-login'),
    makeEndpoint('POST', '/api/auth/wechat-login'),
    makeEndpoint('POST', '/api/auth/wechat-phone-login'),
    makeEndpoint('POST', '/api/auth/wechat/get-openid'),
    makeEndpoint('GET', '/api/auth/me'),

    makeEndpoint('POST', '/api/admin/login'),
    makeEndpoint('GET', '/api/admin/dashboard/stats'),
    makeEndpoint('GET', '/api/admin/users'),
    makeEndpoint('GET', '/api/admin/users/:id'),
    makeEndpoint('GET', '/api/admin/users/:id/stats'),
    makeEndpoint('POST', '/api/admin/users/ban'),
    makeEndpoint('GET', '/api/admin/avatars'),
    makeEndpoint('POST', '/api/admin/avatars/toggle-status'),
    makeEndpoint('GET', '/api/admin/orders'),
    makeEndpoint('GET', '/api/admin/orders/acceptance-overdue'),
    makeEndpoint('GET', '/api/admin/queues/supply'),
    makeEndpoint('POST', '/api/admin/orders/update-status'),
    makeEndpoint('GET', '/api/admin/skills'),
    makeEndpoint('POST', '/api/admin/skills'),
    makeEndpoint('PUT', '/api/admin/skills/:id'),
    makeEndpoint('DELETE', '/api/admin/skills/:id'),
    makeEndpoint('PUT', '/api/admin/skills/:id/status'),
    makeEndpoint('GET', '/api/admin/posts'),
    makeEndpoint('PUT', '/api/admin/posts/:id/review'),
    makeEndpoint('DELETE', '/api/admin/posts/:id'),
    makeEndpoint('GET', '/api/admin/finance/stats'),
    makeEndpoint('GET', '/api/admin/finance/transactions'),
    makeEndpoint('POST', '/api/admin/finance/withdraw/:id/approve'),
    makeEndpoint('POST', '/api/admin/finance/withdraw/:id/reject'),
    makeEndpoint('GET', '/api/admin/referral/stats'),
    makeEndpoint('GET', '/api/admin/referral/list'),
    makeEndpoint('PUT', '/api/admin/referral/settings'),
    makeEndpoint('GET', '/api/admin/activities/campaign'),
    makeEndpoint('PUT', '/api/admin/activities/campaign'),
    makeEndpoint('GET', '/api/admin/activities/campaign/stats'),
    makeEndpoint('GET', '/api/admin/settings/admins'),
    makeEndpoint('POST', '/api/admin/settings/admins'),
    makeEndpoint('DELETE', '/api/admin/settings/admins/:id'),
    makeEndpoint('PUT', '/api/admin/settings/password'),
    makeEndpoint('GET', '/api/admin/settings/config'),
    makeEndpoint('PUT', '/api/admin/settings/config'),

    makeEndpoint('GET', '/api/user/profile'),
    makeEndpoint('PUT', '/api/user/profile'),
    makeEndpoint('GET', '/api/user/openid'),
    makeEndpoint('GET', '/api/user/stats'),
    makeEndpoint('GET', '/api/user/learning-progress'),
    makeEndpoint('GET', '/api/user/security-status'),
    makeEndpoint('POST', '/api/user/change-password'),

    makeEndpoint('GET', '/api/notifications'),
    makeEndpoint('GET', '/api/notifications/unread-count'),
    makeEndpoint('GET', '/api/notifications/settings'),
    makeEndpoint('PUT', '/api/notifications/settings'),
    makeEndpoint('PUT', '/api/notifications/:id/read'),
    makeEndpoint('POST', '/api/notifications/urge-review'),
    makeEndpoint('PUT', '/api/notifications/read-all'),
    makeEndpoint('POST', '/api/notifications'),

    makeEndpoint('POST', '/api/order'),
    makeEndpoint('PUT', '/api/order/:id'),
    makeEndpoint('GET', '/api/order/list'),
    makeEndpoint('GET', '/api/order/open'),
    makeEndpoint('GET', '/api/order/stats'),
    makeEndpoint('GET', '/api/order/:id'),
    makeEndpoint('GET', '/api/order/:id/feedback'),
    makeEndpoint('GET', '/api/order/:id/rating'),
    makeEndpoint('GET', '/api/order/:id/dispatch-status'),
    makeEndpoint('PUT', '/api/order/:id/status'),
    makeEndpoint('PUT', '/api/order/:id/accept'),
    makeEndpoint('PUT', '/api/order/:id/result'),
    makeEndpoint('DELETE', '/api/order/:id'),
    makeEndpoint('POST', '/api/order/:id/cancel'),
    makeEndpoint('POST', '/api/order/:id/repay'),

    makeEndpoint('POST', '/api/order-dispatch/:id/dispatch'),
    makeEndpoint('GET', '/api/order-dispatch/:id/progress'),
    makeEndpoint('GET', '/api/order-dispatch/:id/status'),
    makeEndpoint('GET', '/api/order-dispatch/recommend/:orderId'),
    makeEndpoint('GET', '/api/order-dispatch/request/:requestId'),
    makeEndpoint('POST', '/api/order-dispatch/:orderId/dispatch-avatar'),
    makeEndpoint('GET', '/api/order-dispatch/pending-requests'),
    makeEndpoint('PUT', '/api/order-dispatch/request/:requestId/confirm'),
    makeEndpoint('PUT', '/api/order-dispatch/request/:requestId/reject'),
    makeEndpoint('PUT', '/api/order-dispatch/:id/cancel'),
    makeEndpoint('GET', '/api/order-dispatch/avatar/:avatarId/accepted-orders'),
    makeEndpoint('GET', '/api/order-dispatch/avatar/:avatarId/notifications'),
    makeEndpoint('POST', '/api/order-dispatch/avatar/:avatarId/accept/:orderId'),
    makeEndpoint('POST', '/api/order-dispatch/dispatch/:dispatchId/decline'),
    makeEndpoint('PUT', '/api/order-dispatch/execution/:executionId/status'),
    makeEndpoint('PUT', '/api/order-dispatch/request/:requestId/status'),
    makeEndpoint('POST', '/api/order-dispatch/:orderId/dispatch-all'),
    makeEndpoint('POST', '/api/order-dispatch/:orderId/notify'),
    makeEndpoint('POST', '/api/order-dispatch/timeout/check'),
    makeEndpoint('POST', '/api/order-dispatch/:orderId/reassign'),
    makeEndpoint('GET', '/api/order-dispatch/:orderId/timeout-logs'),
    makeEndpoint('GET', '/api/order-dispatch/:orderId/timeline'),
    makeEndpoint('GET', '/api/order-dispatch/:orderId/timeline-summary'),
    makeEndpoint('GET', '/api/order-dispatch/:orderId/avatar-timeline'),
    makeEndpoint('GET', '/api/order-dispatch/avatar-events'),

    makeEndpoint('GET', '/api/order-processing/status/:id'),
    makeEndpoint('POST', '/api/order-processing/validate-link'),
    makeEndpoint('POST', '/api/order-processing/create'),
    makeEndpoint('POST', '/api/order-processing/confirm/:id'),
    makeEndpoint('POST', '/api/order-processing/publish/:id'),
    makeEndpoint('POST', '/api/order-processing/feedback/:id'),
    makeEndpoint('PUT', '/api/order-processing/accept/:id'),
    makeEndpoint('POST', '/api/order-processing/dispute/:id'),
    makeEndpoint('GET', '/api/order-processing/disputes'),
    makeEndpoint('POST', '/api/order-processing/disputes/resolve'),
    makeEndpoint('POST', '/api/order-processing/urge-acceptance/:id'),
    makeEndpoint('POST', '/api/order-processing/revision/:id'),

    makeEndpoint('POST', '/api/order-results'),
    makeEndpoint('GET', '/api/order-results/order/:orderId'),
    makeEndpoint('GET', '/api/order-results/avatar/:avatarId'),

    makeEndpoint('POST', '/api/content-generation/generate'),
    makeEndpoint('POST', '/api/content-generation/retry/:requestId'),
    makeEndpoint('GET', '/api/content-generation/request/:requestId/avatar/:avatarId'),
    makeEndpoint('GET', '/api/content-generation/content-images/:contentId'),
    makeEndpoint('GET', '/api/content-generation/content/:contentId'),
    makeEndpoint('POST', '/api/content-generation/content/:contentId/status'),
    makeEndpoint('GET', '/api/content-generation/history/avatar/:avatarId'),
    makeEndpoint('POST', '/api/content-generation/content/:contentId/publish-proof'),
    makeEndpoint('POST', '/api/content-generation/content/:contentId/verify'),
    makeEndpoint('POST', '/api/content-generation/order/:orderId/retry-publish'),
    makeEndpoint('DELETE', '/api/content-generation/clear/:orderId'),

    makeEndpoint('POST', '/api/image-gen/generate'),
    makeEndpoint('GET', '/api/image-gen/history'),
    makeEndpoint('GET', '/api/image-gen/:id'),
    makeEndpoint('DELETE', '/api/image-gen/:id'),

    makeEndpoint('POST', '/api/video/generate-promo'),

    makeEndpoint('POST', '/api/ai/generate'),
    makeEndpoint('GET', '/api/ai/status/:requestId'),

    makeEndpoint('POST', '/api/ai-skill/generate'),
    makeEndpoint('GET', '/api/ai-skill/history'),
    makeEndpoint('GET', '/api/ai-skill/usage-limit'),
    makeEndpoint('GET', '/api/ai-skill/record/:id'),
    makeEndpoint('POST', '/api/ai-skill/upload'),
    makeEndpoint('DELETE', '/api/ai-skill/record/:id'),
    makeEndpoint('POST', '/api/ai-skill/records/delete'),

    makeEndpoint('POST', '/api/avatar'),
    makeEndpoint('GET', '/api/avatar'),
    makeEndpoint('GET', '/api/avatar/list'),
    makeEndpoint('GET', '/api/avatar/search'),
    makeEndpoint('GET', '/api/avatar/:id'),
    makeEndpoint('GET', '/api/avatar/:id/voice-status'),
    makeEndpoint('PUT', '/api/avatar/:id'),
    makeEndpoint('DELETE', '/api/avatar/:id'),
    makeEndpoint('GET', '/api/avatar/:id/skills'),
    makeEndpoint('POST', '/api/avatar/:id/skills'),
    makeEndpoint('DELETE', '/api/avatar/:id/skills/:skillId'),
    makeEndpoint('GET', '/api/avatar/:id/memories'),
    makeEndpoint('POST', '/api/avatar/:id/memories'),
    makeEndpoint('DELETE', '/api/avatar/:id/memories/:memoryId'),
    makeEndpoint('GET', '/api/avatar/:id/stats'),
    makeEndpoint('PUT', '/api/avatar/:id/trust'),
    makeEndpoint('PUT', '/api/avatar/trust/all'),
    makeEndpoint('POST', '/api/avatar/:id/hosting/settings'),
    makeEndpoint('GET', '/api/avatar/:avatarId/accounts'),
    makeEndpoint('POST', '/api/avatar/accounts'),
    makeEndpoint('PUT', '/api/avatar/accounts/:id'),
    makeEndpoint('DELETE', '/api/avatar/accounts/:id'),
    makeEndpoint('POST', '/api/avatar/publish/wechat-draft'),

    makeEndpoint('POST', '/api/avatar-agent/:avatarId/chat'),
    makeEndpoint('POST', '/api/avatar-agent/:avatarId/think'),
    makeEndpoint('GET', '/api/avatar-agent/:avatarId/config'),
    makeEndpoint('PUT', '/api/avatar-agent/:avatarId/config'),
    makeEndpoint('POST', '/api/avatar-agent/:avatarId/initialize'),
    makeEndpoint('GET', '/api/avatar-agent/:avatarId/memories'),
    makeEndpoint('GET', '/api/avatar-agent/:avatarId/preferences/:userId'),
    makeEndpoint('GET', '/api/avatar-agent/:avatarId/experiences'),
    makeEndpoint('POST', '/api/avatar-agent/:avatarId/feedback'),
    makeEndpoint('GET', '/api/avatar-agent/:avatarId/learning-stats'),
    makeEndpoint('GET', '/api/avatar-agent/:avatarId/capabilities'),
    makeEndpoint('POST', '/api/avatar-agent/:avatarId/distill/:sourceAvatarId'),
    makeEndpoint('POST', '/api/avatar-agent/:avatarId/personalize/:userId'),

    makeEndpoint('GET', '/api/skills'),
    makeEndpoint('GET', '/api/skills/avatar/:avatarId'),
    makeEndpoint('POST', '/api/skills/avatar/:avatarId/:skillId'),
    makeEndpoint('DELETE', '/api/skills/avatar/:avatarId/:skillId'),
    makeEndpoint('POST', '/api/skills/avatar/:avatarId/batch'),
    makeEndpoint('POST', '/api/skills/:id/try'),
    makeEndpoint('GET', '/api/skills/categories'),

    makeEndpoint('POST', '/api/chat/conversation'),
    makeEndpoint('GET', '/api/chat/conversations'),
    makeEndpoint('GET', '/api/chat/conversation/:id/messages'),
    makeEndpoint('POST', '/api/chat/send'),
    makeEndpoint('DELETE', '/api/chat/conversation/:id'),

    makeEndpoint('POST', '/api/tasks'),
    makeEndpoint('GET', '/api/tasks'),
    makeEndpoint('GET', '/api/tasks/stats'),
    makeEndpoint('GET', '/api/tasks/:id'),
    makeEndpoint('PUT', '/api/tasks/:id/status'),

    makeEndpoint('GET', '/api/subscription/plans'),
    makeEndpoint('GET', '/api/subscription/status'),
    makeEndpoint('GET', '/api/subscription/check'),
    makeEndpoint('POST', '/api/subscription/order'),

    makeEndpoint('POST', '/api/payment/wechat/create'),
    makeEndpoint('POST', '/api/payment/wechat/notify'),
    makeEndpoint('GET', '/api/payment/order/:orderId/status'),
    makeEndpoint('GET', '/api/payment/orders'),
    makeEndpoint('GET', '/api/payment/plans'),
    makeEndpoint('GET', '/api/payment/subscription'),
    makeEndpoint('POST', '/api/payment/sync/:outTradeNo'),
    makeEndpoint('POST', '/api/payment/shipping/upload'),

    makeEndpoint('GET', '/api/earnings/leaderboard'),
    makeEndpoint('GET', '/api/earnings/overview'),
    makeEndpoint('GET', '/api/earnings'),
    makeEndpoint('POST', '/api/earnings/withdraw'),

    makeEndpoint('GET', '/api/user-stats/overview'),
    makeEndpoint('GET', '/api/user-stats/orders'),
    makeEndpoint('GET', '/api/user-stats/contents'),

    makeEndpoint('GET', '/api/activities/recent'),
    makeEndpoint('GET', '/api/activities/campaign/active'),
    makeEndpoint('POST', '/api/activities/campaign/track'),

    makeEndpoint('GET', '/api/referral/code'),
    makeEndpoint('POST', '/api/referral/code'),
    makeEndpoint('POST', '/api/referral/use'),
    makeEndpoint('GET', '/api/referral/stats'),
    makeEndpoint('GET', '/api/referral/list'),

    makeEndpoint('GET', '/api/voice-clone/presets'),
    makeEndpoint('POST', '/api/voice-clone/start'),
    makeEndpoint('GET', '/api/voice-clone/status/:voiceId'),
    makeEndpoint('POST', '/api/voice-clone/synthesize'),

    makeEndpoint('POST', '/api/upload/order-screenshot'),
    makeEndpoint('POST', '/api/upload/avatar-image'),
    makeEndpoint('POST', '/api/upload/image'),
    makeEndpoint('POST', '/api/upload/audio'),
    makeEndpoint('POST', '/api/upload/video'),
    makeEndpoint('POST', '/api/upload'),

    makeEndpoint('GET', '/api/media/sign-url'),

    makeEndpoint('GET', '/api/social/followers'),
    makeEndpoint('POST', '/api/social/post'),
    makeEndpoint('GET', '/api/social/avatar-posts'),
    makeEndpoint('GET', '/api/social/today-stats'),
    makeEndpoint('GET', '/api/social/total-stats'),
    makeEndpoint('GET', '/api/social/posts'),
    makeEndpoint('GET', '/api/social/post/:id'),
    makeEndpoint('GET', '/api/social/posts/avatar/:avatarId'),
    makeEndpoint('DELETE', '/api/social/post/:id'),
    makeEndpoint('POST', '/api/social/post/:id/like'),
    makeEndpoint('POST', '/api/social/post/:id/comment'),
    makeEndpoint('GET', '/api/social/post/:id/comments'),
    makeEndpoint('GET', '/api/social/post/:id/likes'),
    makeEndpoint('POST', '/api/social/follow/:userId'),
    makeEndpoint('GET', '/api/social/user/:userId/posts'),
    makeEndpoint('POST', '/api/social/post/:id/share'),
    makeEndpoint('GET', '/api/social/all-posts'),
    makeEndpoint('GET', '/api/social/related-posts'),

    makeEndpoint('POST', '/api/tikhub/verify-post'),
    makeEndpoint('POST', '/api/tikhub/douyin/user-info'),
    makeEndpoint('POST', '/api/tikhub/xiaohongshu/user-info'),

    makeEndpoint('POST', '/api/sms/send'),
    makeEndpoint('POST', '/api/sms/notify/dispatch'),
    makeEndpoint('POST', '/api/sms/notify/completion'),
    makeEndpoint('GET', '/api/sms/templates'),

    makeEndpoint('POST', '/api/palm-reading/create'),
    makeEndpoint('GET', '/api/palm-reading/progress/:id'),
    makeEndpoint('GET', '/api/palm-reading/history'),
    makeEndpoint('DELETE', '/api/palm-reading/:id'),
    makeEndpoint('DELETE', '/api/palm-reading'),

    makeEndpoint('POST', '/api/vision/analyze'),

    makeEndpoint('POST', '/api/audio/asr'),
    makeEndpoint('POST', '/api/asr/recognize'),

    makeEndpoint('GET', '/api/dashboard/stats'),

    makeEndpoint('GET', '/api/agent/tools'),
    makeEndpoint('GET', '/api/agent/progress'),
    makeEndpoint('GET', '/api/agent/result/:taskId'),
    makeEndpoint('POST', '/api/agent/execute'),
    makeEndpoint('GET', '/api/agent/platform-config/:platform'),
    makeEndpoint('GET', '/api/agent/platform-configs'),
    makeEndpoint('POST', '/api/agent/platform-config/:platform'),
    makeEndpoint('POST', '/api/agent/platform-config/:platform/validate'),
    makeEndpoint('DELETE', '/api/agent/platform-config/:platform'),
    makeEndpoint('GET', '/api/agent/skills/:avatarId'),
    makeEndpoint('POST', '/api/agent/skills/:avatarId'),
    makeEndpoint('POST', '/api/agent/publish/:platform'),
    makeEndpoint('POST', '/api/agent/images/generations'),

    makeEndpoint('POST', '/api/analyze/layout')
  ]
}
