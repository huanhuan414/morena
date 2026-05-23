import type { AssertType, EndpointDef, HttpMethod, SaveVarRule } from '../config'

function ep(args: {
  group: string
  id?: string
  name?: string
  method: HttpMethod
  path: string
  query?: Record<string, string | number | boolean | undefined>
  auth?: boolean
  body?: unknown
  formData?: EndpointDef['formData']
  headers?: Record<string, string | undefined>
  asserts: AssertType[]
  save?: SaveVarRule[]
  dependsOn?: string[]
}): EndpointDef {
  return {
    id: args.id ?? `${args.method} ${args.path}`,
    group: args.group,
    name: args.name,
    method: args.method,
    path: args.path,
    query: args.query,
    auth: args.auth,
    body: args.body,
    formData: args.formData,
    headers: args.headers,
    asserts: args.asserts,
    save: args.save,
    dependsOn: args.dependsOn
  }
}

export const regressionEndpoints: EndpointDef[] = [
  ep({
    group: 'smoke',
    method: 'GET',
    path: '/api/hello',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'maxMs', lte: 1500 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.status', equals: 'success' },
      { type: 'jsonPath', path: 'data.data', typeof: 'string' }
    ]
  }),
  ep({
    group: 'smoke',
    method: 'GET',
    path: '/api/health',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'maxMs', lte: 1500 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.status', equals: 'success' },
      { type: 'jsonPath', path: 'data.data', typeof: 'string' }
    ]
  }),

  ep({
    group: 'auth-negative',
    name: 'GET /api/auth/me without token',
    method: 'GET',
    path: '/api/auth/me',
    auth: false,
    asserts: [
      { type: 'status', equals: 401 },
      { type: 'jsonPath', path: 'code', equals: 401 },
      { type: 'jsonPath', path: 'data', typeof: 'null' }
    ]
  }),
  ep({
    group: 'auth-negative',
    name: 'POST /api/auth/phone-login empty body',
    method: 'POST',
    path: '/api/auth/phone-login',
    auth: false,
    body: {},
    asserts: [
      { type: 'status', equals: 400 },
      { type: 'jsonPath', path: 'code', equals: 400 }
    ]
  }),

  ep({
    group: 'order-processing-negative',
    name: 'validate-link unauthorized',
    method: 'POST',
    path: '/api/order-processing/validate-link',
    auth: false,
    body: {},
    asserts: [
      { type: 'status', equals: 401 },
      { type: 'jsonPath', path: 'code', equals: 401 }
    ]
  }),
  ep({
    group: 'order-processing-negative',
    name: 'status unauthorized',
    method: 'GET',
    path: '/api/order-processing/status/api-tests-never-exist',
    auth: false,
    asserts: [
      { type: 'status', equals: 401 },
      { type: 'jsonPath', path: 'code', equals: 401 }
    ]
  }),
  ep({
    group: 'order-processing-negative',
    name: 'confirm unauthorized',
    method: 'POST',
    path: '/api/order-processing/confirm/api-tests-never-exist',
    auth: false,
    body: { content: 'test' },
    asserts: [
      { type: 'status', equals: 401 },
      { type: 'jsonPath', path: 'code', equals: 401 }
    ],
    dependsOn: ['POST /api/order-processing/validate-link']
  })
  ,
  ep({
    group: 'core-chain',
    name: 'me authorized',
    method: 'GET',
    path: '/api/auth/me',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.id', exists: true }
    ],
    save: [{ fromJsonPath: 'data.id', toVar: 'userId' }]
  }),
  ep({
    group: 'core-chain',
    name: 'create avatar',
    method: 'POST',
    path: '/api/avatar',
    body: {
      name: 'api-tests-avatar',
      description: 'api-tests',
      abilities: { chat: true, reading: true, analysis: false }
    },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.id', exists: true }
    ],
    save: [{ fromJsonPath: 'data.id', toVar: 'avatarId' }],
    dependsOn: ['GET /api/auth/me']
  }),
  ep({
    group: 'core-chain',
    name: 'create order (budget=0)',
    method: 'POST',
    path: '/api/order',
    body: {
      title: 'api-tests-order',
      description: 'api-tests',
      contentType: 'text',
      platforms: ['wechat_mp'],
      requirements: {},
      totalPrice: 0,
      avatarCount: 1
    },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.id', exists: true },
      { type: 'jsonPath', path: 'data.status', oneOf: ['pending_payment'] }
    ],
    save: [{ fromJsonPath: 'data.id', toVar: 'orderId' }],
    dependsOn: ['POST /api/avatar']
  }),
  ep({
    group: 'core-chain',
    name: 'force order open (skip payment for tests)',
    method: 'PUT',
    path: '/api/order/:orderId/status',
    body: { status: 'open' },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.status', oneOf: ['open'] }
    ],
    dependsOn: ['POST /api/order']
  }),
  ep({
    group: 'core-chain',
    name: 'dispatch to avatar',
    method: 'POST',
    path: '/api/order-dispatch/:orderId/dispatch-avatar',
    body: { avatarId: '{{avatarId}}' },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.dispatch_id', exists: true }
    ],
    save: [{ fromJsonPath: 'data.dispatch_id', toVar: 'dispatchId' }],
    dependsOn: ['PUT /api/order/:orderId/status']
  }),
  ep({
    group: 'core-chain',
    name: 'accept order as avatar owner',
    method: 'POST',
    path: '/api/order-dispatch/avatar/:avatarId/accept/:orderId',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 }
    ],
    dependsOn: ['POST /api/order-dispatch/:orderId/dispatch-avatar']
  }),
  ep({
    group: 'core-chain',
    name: 'create processing request',
    method: 'POST',
    path: '/api/order-processing/create',
    body: {
      order_id: '{{orderId}}',
      avatar_id: '{{avatarId}}',
      config: { platforms: ['wechat_mp'] }
    },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.requestId', exists: true }
    ],
    save: [{ fromJsonPath: 'data.requestId', toVar: 'requestId' }],
    dependsOn: ['POST /api/order-dispatch/avatar/:avatarId/accept/:orderId']
  }),
  ep({
    group: 'core-chain',
    name: 'confirm content',
    method: 'POST',
    path: '/api/order-processing/confirm/:requestId',
    body: { content: 'api-tests content' },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 }
    ],
    dependsOn: ['POST /api/order-processing/create']
  }),
  ep({
    group: 'core-chain',
    name: 'publish',
    method: 'POST',
    path: '/api/order-processing/publish/:requestId',
    body: { platforms: ['wechat_mp'] },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 }
    ],
    dependsOn: ['POST /api/order-processing/confirm/:requestId']
  }),
  ep({
    group: 'core-chain',
    name: 'submit publish feedback',
    method: 'POST',
    path: '/api/order-processing/feedback/:requestId',
    body: {
      feedback: {
        wechat_mp: {
          link: 'https://weixin.qq.com/',
          note: 'api-tests'
        }
      }
    },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 }
    ],
    dependsOn: ['POST /api/order-processing/publish/:requestId']
  }),
  ep({
    group: 'core-chain',
    name: 'acceptance',
    method: 'PUT',
    path: '/api/order-processing/accept/:requestId',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.status', oneOf: ['settled'] }
    ],
    dependsOn: ['POST /api/order-processing/feedback/:requestId']
  }),
  ep({
    group: 'core-chain',
    name: 'order should be completed (or progressing)',
    method: 'GET',
    path: '/api/order/:orderId',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.status', exists: true }
    ],
    dependsOn: ['PUT /api/order-processing/accept/:requestId']
  }),
  ep({
    group: 'core-chain',
    name: 'earnings overview',
    method: 'GET',
    path: '/api/earnings/overview',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.totalEarnings', typeof: 'number' },
      { type: 'jsonPath', path: 'data.totalOrders', typeof: 'number' }
    ],
    dependsOn: ['GET /api/order/:orderId']
  }),
  ep({
    group: 'payment-smoke',
    id: 'GET /api/payment/plans (payment)',
    method: 'GET',
    path: '/api/payment/plans',
    auth: false,
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data', typeof: 'array' }
    ]
  }),
  ep({
    group: 'payment-smoke',
    id: 'GET /api/auth/me (payment)',
    method: 'GET',
    path: '/api/auth/me',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.id', exists: true }
    ],
    save: [{ fromJsonPath: 'data.id', toVar: 'paymentUserId' }]
  }),
  ep({
    group: 'payment-smoke',
    id: 'POST /api/payment/wechat/create (subscription)',
    method: 'POST',
    path: '/api/payment/wechat/create',
    body: { userId: '{{paymentUserId}}', openid: 'mock_openid', planId: 'plan_basic' },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.outTradeNo', exists: true },
      { type: 'jsonPath', path: 'data.orderId', exists: true }
    ],
    save: [
      { fromJsonPath: 'data.outTradeNo', toVar: 'outTradeNo' },
      { fromJsonPath: 'data.orderId', toVar: 'paymentOrderId' }
    ],
    dependsOn: ['GET /api/auth/me (payment)']
  }),
  ep({
    group: 'payment-smoke',
    id: 'POST /api/payment/mock/pay-success/:outTradeNo',
    method: 'POST',
    path: '/api/payment/mock/pay-success/:outTradeNo',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 }
    ],
    dependsOn: ['POST /api/payment/wechat/create (subscription)']
  }),
  ep({
    group: 'payment-smoke',
    id: 'GET /api/payment/order/:paymentOrderId/status',
    method: 'GET',
    path: '/api/payment/order/:paymentOrderId/status',
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.status', equals: 'paid' }
    ],
    dependsOn: ['POST /api/payment/mock/pay-success/:outTradeNo']
  }),
  ep({
    group: 'payment-smoke',
    id: 'GET /api/payment/subscription (payment)',
    method: 'GET',
    path: '/api/payment/subscription',
    query: { userId: '{{paymentUserId}}' },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.planId', equals: 'plan_basic' },
      { type: 'jsonPath', path: 'data.status', equals: 'active' }
    ],
    dependsOn: ['POST /api/payment/mock/pay-success/:outTradeNo']
  }),
  ep({
    group: 'upload-smoke',
    id: 'POST /api/upload/image (mock)',
    method: 'POST',
    path: '/api/upload/image',
    auth: false,
    formData: {
      file: {
        filename: 'api-tests.png',
        contentType: 'image/png',
        base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO9Wl0cAAAAASUVORK5CYII='
      }
    },
    asserts: [
      { type: 'status', equals: 200 },
      { type: 'jsonPath', path: 'code', equals: 200 },
      { type: 'jsonPath', path: 'data.url', exists: true }
    ]
  }),
  ep({
    group: 'payment-negative',
    id: 'POST /api/payment/wechat/create missing openid',
    method: 'POST',
    path: '/api/payment/wechat/create',
    body: { userId: '{{userId}}', planId: 'plan_basic' },
    asserts: [
      { type: 'status', equals: 400 },
      { type: 'jsonPath', path: 'code', equals: 400 }
    ],
    dependsOn: ['GET /api/auth/me']
  }),
  ep({
    group: 'payment-negative',
    id: 'POST /api/payment/wechat/create invalid planId',
    method: 'POST',
    path: '/api/payment/wechat/create',
    body: { userId: '{{userId}}', openid: 'mock_openid', planId: 'plan_not_exist' },
    asserts: [
      { type: 'status', equals: 404 },
      { type: 'jsonPath', path: 'code', equals: 404 }
    ],
    dependsOn: ['GET /api/auth/me']
  })
]
