# Agent 任务看板

## 0. 当前阶段

- 当前阶段：`F`
- 当前阶段状态：`in_progress`
- 主控 Agent：`main`

## 1. 阶段 A：规则冻结

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| A-1 | 冻结业务主链 | 产品经理/主控Agent | completed | - | 单一业务主链说明 |
| A-2 | 冻结状态机 | 架构Agent | completed | A-1 | 状态机冻结文档 |
| A-3 | 冻结字段字典 | 架构Agent | completed | A-2 | 字段字典 |
| A-4 | 冻结 DTO 契约 | 架构Agent | completed | A-3 | DTO 契约文档 |
| A-5 | 冻结导航与回流矩阵 | 架构Agent | completed | A-1 | 导航矩阵文档 |
| A-6 | 冻结风险清单 | 主控Agent | completed | A-2,A-3,A-4,A-5 | 风险清单 |

## 2. 阶段 B：分身链路收敛

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| B-1 | 统一分身参数协议 | 前端Agent/后端Agent | completed | A-3,A-4,A-5 | 参数协议落地 |
| B-2 | 统一托管字段协议 | 后端Agent | completed | A-3 | 托管字段收敛 |
| B-3 | 修复好友上下文 | 前端Agent | completed | A-5,B-1 | 好友入口与上下文闭环 |
| B-4 | 修复创建后回流刷新 | 前端Agent | completed | A-5 | 回流刷新闭环 |
| B-5 | 分身链路回归 | 验证Agent | completed | B-1,B-2,B-3,B-4 | 回归结果 |

## 3. 阶段 C：订单分发与处理链路收敛

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| C-1 | 统一接单入口 | 后端Agent/前端Agent | completed | A-2,A-4,A-5 | 接单返回与路由统一 |
| C-2 | 统一订单主链 | 前端Agent | completed | C-1 | 单一主链入口 |
| C-3 | 统一订单状态事实源 | 后端Agent | completed | A-2,A-3 | 单一状态聚合器 |
| C-4 | 统一订单详情 DTO | 后端Agent | completed | A-4,C-3 | 订单详情 DTO |
| C-5 | 统一验收入口 | 前端Agent/后端Agent | completed | C-2,C-3 | 单一验收入口 |
| C-6 | 订单主链回归 | 验证Agent | completed | C-1,C-2,C-3,C-4,C-5 | 回归结果 |

## 4. 阶段 D：发布域模型与反馈验收收敛

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| D-1 | 冻结 canonical 平台映射 | 架构Agent | completed | A-3 | 平台映射表 |
| D-2 | 冻结发布反馈字段字典 | 架构Agent | completed | A-3,D-1 | 发布反馈字段字典 |
| D-3 | 落地发布引导与绑定阻断 | 前端Agent/后端Agent | completed | D-1,D-2 | 阻断与引导闭环 |
| D-4 | 落地反馈与重试机制 | 前端Agent/后端Agent | completed | D-2 | 反馈幂等与重试 |
| D-5 | 发布域回归 | 验证Agent | completed | D-3,D-4 | 回归结果 |

## 5. 阶段 E：导航与回流治理

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| E-1 | 清理页面注册与路径不一致 | 前端Agent | completed | A-5 | 路径修复清单 |
| E-2 | 清理跳转 API 误用 | 前端Agent | completed | A-5 | 跳转规范落地 |
| E-3 | 统一页面回流机制 | 前端Agent | completed | A-5 | 回流机制 |
| E-4 | 统一响应解包模型 | 前端Agent/后端Agent | completed | A-4 | 解包模型 |
| E-5 | 导航治理回归 | 验证Agent | completed | E-1,E-2,E-3,E-4 | 回归结果 |

## 6. 阶段 F：支付与订阅运营闭环

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| F-1 | 冻结订阅产品模型 | 产品经理/主控Agent | completed | - | 套餐与权益文档 |
| F-2 | 冻结支付状态机 | 架构Agent | completed | F-1 | 支付状态机 |
| F-3 | 打通支付配置与回写 | 后端Agent | completed | F-2 | 支付后端闭环 |
| F-4 | 打通订阅前端闭环 | 前端Agent | completed | F-1,F-3 | 订阅前端闭环 |
| F-5 | 支付与订阅回归 | 验证Agent | completed | F-3,F-4 | 回归结果 |

## 7. 阶段 G：我的分身中长期产品能力执行化

| 任务ID | 任务 | owner | status | depends_on | deliverables |
| --- | --- | --- | --- | --- | --- |
| G-1 | 创建流程优化任务化 | 产品经理/主控Agent | completed | B-5 | 创建流程任务包 |
| G-2 | 心聊与社交体验优化任务化 | 产品经理/主控Agent | completed | B-5 | 社交与心聊任务包 |
| G-3 | 收益体系透明化任务化 | 产品经理/主控Agent | completed | F-5 | 收益体系任务包 |

## 8. 回写模板

每次执行后，主控 Agent 追加记录：

| 任务ID | changed_files | validation | blockers | next_action |
| --- | --- | --- | --- | --- |

| A-1 | `.trae/specs/clarify-avatar-product-logic/freeze-business-chain.md` | 文档冻结完成；依赖检查通过；可进入 A-2 和 A-5 | - | 执行 A-2 冻结状态机 |
| A-2 | `.trae/specs/clarify-avatar-product-logic/freeze-state-machines.md` | 文档冻结完成；processing/order/dispatch/publish 状态已收口 | - | 执行 A-3 字段字典冻结 |
| A-3 | `.trae/specs/clarify-avatar-product-logic/freeze-field-dictionary.md` | 文档冻结完成；主字段与兼容字段已冻结 | - | 执行 A-4 DTO 契约冻结 |
| A-4 | `.trae/specs/clarify-avatar-product-logic/freeze-dto-contracts.md` | 文档冻结完成；关键接口 DTO 已冻结 | - | 执行 A-5 导航矩阵冻结 |
| A-5 | `.trae/specs/clarify-avatar-product-logic/freeze-navigation-matrix.md` | 文档冻结完成；主链页面与参数已冻结 | - | 执行 A-6 风险清单冻结 |
| A-6 | `.trae/specs/clarify-avatar-product-logic/freeze-risk-register.md` | 风险清单冻结完成；阶段 A 门禁满足 | - | 进入阶段 B 开发 |
| B-1/B-2/C-3 预备变更 | `server/src/modules/avatar/hosting.service.ts` `server/src/modules/recommendation/recommendation.service.ts` `server/src/modules/order/order.service.ts` `server/src/modules/order-processing/order-processing.service.ts` `src/pages/order/order-content-creation/index.tsx` `src/pages/generated-content/index.tsx` `src/pages/avatar-orders/index.tsx` `src/pages/order/order-processing/index.tsx` | `pnpm validate` 通过；`pnpm --filter server build` 通过 | - | 继续收敛 B-1/B-2 并进入回归 |
| B-1/B-2/B-3/B-4/B-5 | `src/pages/avatar/avatar-manage/index.tsx` `src/pages/avatar/avatar-create/index.tsx` `src/components/guide/NewUserGuide.tsx` 及前序 B 阶段相关文件 | `pnpm validate` 通过；`pnpm --filter server build` 通过；分身参数、托管字段、好友入口、创建回流已收口 | - | 进入阶段 C |
| C-1/C-2 持续收敛 | `src/pages/index/index.tsx` `src/pages/generated-content/index.tsx` `src/pages/order/order-list/index.tsx` `src/pages/order/order-square/index.tsx` `src/pages/avatar-orders/index.tsx` | `pnpm validate` 通过；`pnpm --filter server build` 通过；主链观察入口继续向桥接页收口 | 订单广场接单仍走旧接口 | 继续收敛 C-1/C-2/C-5 |
| C-1/C-2/C-5 持续收敛 | `src/pages/order/order-square/index.tsx` `src/pages/order/order-acceptance/index.tsx` `src/pages/avatar-orders/index.tsx` `src/pages/order-acceptance-feedback/index.tsx` | `pnpm validate` 通过；订单广场接单已切到统一 dispatch 接口并成功回桥接页；验收页仅保留 `awaiting_acceptance`；历史 `order-acceptance-feedback` 已降级为兼容跳转页 | C-3/C-4 仍待完成，后端订单状态事实源与订单详情 DTO 尚未完全收口 | 继续执行 C-3/C-4，并在完成后做 C-6 主链回归 |
| C-3/C-4 持续收敛 | `server/src/modules/order-dispatch/order-dispatch.service.ts` `server/src/modules/order/order.service.ts` | `pnpm validate` 通过；dispatch 接单后不再直接写订单状态，统一回调 `OrderService.syncOrderStatusByContent()`；订单详情已补齐 `expectedQuantity`、`quantityPerAvatar`、`orderType`、`updatedAt`、`completedAt` 等 canonical 字段，并收敛 avatar 状态映射 | 管理后台仍保留人工改单状态入口；C-6 主链回归尚未执行 | 继续做 C-6 回归，并视需要收口后台人工改单口径 |
| C-6 主链回归（第一轮） | `src/pages/order/order-processing/index.tsx` `src/pages/order/order-content-creation/index.tsx` | `pnpm validate` 通过；桥接页跳内容生成页时已保留 `orderId/requestId/avatarId`；内容生成页状态查询优先使用 `requestId`；生成中部分预览已适配 canonical `generating` 状态 | 仍有少量统计/展示页保留历史兼容状态标签，需继续扫描低风险残留 | 继续做剩余状态口径清理与回归验证 |
| C-6 主链回归（第二轮） | `server/src/modules/order/order.service.ts` `src/pages/order-stats/index.tsx` | `pnpm validate` 通过；订单详情 `summary_stats` 已补齐作品数与互动数据聚合；`order-stats` 已消费 canonical 状态并移除外部占位图依赖 | 列表与展示页仍有少量历史状态文案兼容，属于低风险表现层残留 | 继续清理低风险展示残留并准备阶段 C 回归收口 |
| C-6 主链回归（第三轮） | `server/src/modules/order/order.service.ts` | `pnpm validate` 通过；订单评分提交已优先关联已完成/已参与的分身，不再直接依赖单一 `order.avatar_id`，降低多分身订单评价错绑风险 | 展示层仍有少量历史状态文案和兼容映射，属于低风险残留 | 继续清理表现层残留并判断阶段 C 是否可整体收口 |
| C-6 主链回归（第四轮） | `src/pages/order/avatar-orders/index.tsx` `src/pages/order/avatar-orders/index.css` `src/pages/order/avatar-orders/index.config.ts` | `pnpm validate` 通过；已删除未注册且无引用的旧重复页面，避免继续保留陈旧状态口径与重复实现 | 剩余主要是兼容旧数据的保守映射逻辑，暂无主链阻塞项 | 评估阶段 C 是否满足整体完成条件，并仅保留必要兼容层 |
| C-1/C-6 收口 | `server/src/modules/order/order.controller.ts` | `pnpm validate` 通过；旧兼容接单路由 `PUT /api/order/:id/accept` 已内部委托统一 dispatch 接单链并返回统一结果；阶段 C 主链阻塞项已完成收口 | 管理后台人工改单状态入口仍存在，但属于后台治理范围，不阻塞订单主链闭环 | 进入阶段 D，冻结平台映射与发布反馈字段字典 |
| D-1 | `.trae/specs/clarify-avatar-product-logic/freeze-platform-canonical-map.md` | 文档冻结完成；canonical 平台 key、历史别名映射、输入输出规则与禁止事项已落地 | - | 执行 D-2 冻结发布反馈字段字典 |
| D-2 | `.trae/specs/clarify-avatar-product-logic/freeze-publish-feedback-dictionary.md` | 文档冻结完成；发布反馈 canonical 结构、写入字段、验证字段、聚合规则与兼容规则已落地 | - | 进入 D-3/D-4 开发落地 |
| D-3/D-4 持续落地 | `server/src/modules/order-processing/order-processing.service.ts` `src/pages/order/order-publish-guide/index.tsx` `src/pages/order-publish-feedback/index.tsx` | `pnpm validate` 通过；发布引导页已阻断“未绑定平台直接完成发布”；发布成功后平台状态初始化为“待提交发布反馈”；反馈页已回填历史反馈并统一提交 `submittedAt/status/verify*` 字段；后端提交反馈后会同步写回 canonical `publish_status.platformStatus` | 互动指标 `metrics` 录入 UI 仍未显式开放，目前仅完成结构冻结与后端支持 | 继续执行 D-5 发布域回归，并视需要补反馈指标录入 UI |
| D-4 补齐互动指标 | `src/pages/order-publish-feedback/index.tsx` `src/pages/order-publish-feedback/index.css` `src/pages/order/order-acceptance/index.tsx` | `pnpm validate` 通过；反馈页已开放 `views/likes/comments/shares` 录入并按 `metrics` 提交；验收页已兼容读取 `metrics.*` 与 `images[]`，发布反馈字典的写入与展示链路闭合 | 尚未做端到端人工回归记录，需补 D-5 结果 | 继续执行 D-5 发布域回归并确认阶段 D 是否可完成 |
| D-5 发布域回归 | `server/src/modules/order-processing/order-processing.service.ts` `src/pages/order-completed/index.tsx` `src/pages/index/index.tsx` `src/pages/avatar/avatar-manage/index.tsx` | `pnpm validate` 通过；反馈读写已统一经过 canonical 字典归一；完成页已按平台展示反馈；通知入口错路由已修正为已注册页面；阶段 D 主链无阻塞残留，仅保留历史字段兼容读取 | 仍需继续做阶段 E 的页面注册与导航路径系统清理 | 进入 E-1/E-2 导航治理扫描与修复 |
| E-1/E-2 第一轮收敛 | `src/pages/login/index.tsx` `src/pages/avatar-recommend/index.tsx` `src/pages/index/index.tsx` `src/pages/avatar/avatar-manage/index.tsx` | `pnpm validate` 通过；已修复登录回跳 TabBar 判定错误、发单成功后错误 `switchTab` 到非 TabBar 页面、通知入口错路由到未注册页面的问题 | 仍需继续扫描其它导航 API 误用与路径不一致点 | 继续清理剩余跳转 API 误用 |
| E-1 清理未注册旧页 | `src/pages/order/pending-order` `src/pages/order/order-feedback` `src/pages/settings` `src/pages/security` | `pnpm validate` 通过；已删除未注册且无引用的旧重复页面，减少导航治理噪音和误读风险 | 尚未完成所有页面注册与跳转矩阵对齐 | 继续执行 E-2/E-3，收口剩余路径与回流问题 |
| E-1/E-2 第二轮收敛 | `src/pages/admin/users/index.tsx` `src/pages/admin/avatars/index.tsx` | `pnpm validate` 通过；已修复后台用户详情路由漏 `/index` 的路径错误；后台分身页去除跳向不存在页面(`avatars/detail`,`avatars/chats`)的死链入口，改为可用提示 | 仍有外部小程序路径 `pages/discover/discover`（非项目内页） | 继续执行 E-3 回流机制收敛与 E-5 回归 |
| E-3/E-4 十次自动执行收敛 | `src/pages/pending-order/index.tsx` `src/pages/avatar-recommend/index.tsx` `src/pages/avatar/avatar-manage/index.tsx` `src/pages/order/order-list/index.tsx` `src/pages/index/index.tsx` `src/pages/profile/index.tsx` `src/pages/mind-chat/index.tsx` `src/pages/order-completed/index.tsx` `src/pages/order-feedback/index.tsx` | 连续 10 次自动执行已完成且每轮 `pnpm validate` 通过；补齐 `pending-order` 回流刷新、首页/我的/分身/订单/聊天/完成页/反馈页响应解包兼容，移除分身管理页硬编码测试 userId，阶段 E 的回流与解包治理继续收敛 | `E-5` 端到端导航回归尚未做，`E-3/E-4` 还可继续向更多低频页扩展 | 按用户要求暂停，等待确认下一批具体执行任务 |
| E-3/E-4/E-5 收口 | `src/utils/api-response.ts` `src/utils/navigation.ts` `src/hooks/useNotifications.ts` `src/pages/admin/avatars/index.tsx` `src/pages/admin/users/index.tsx` `src/pages/admin/orders/index.tsx` `src/pages/admin/content/index.tsx` `src/pages/admin/finance/index.tsx` `src/pages/admin/skills/index.tsx` `src/pages/order/order-processing/index.tsx` `src/pages/order-publish-feedback/index.tsx` `src/pages/order-acceptance-feedback/index.tsx` `src/pages/order-feedback/index.tsx` | `pnpm validate` 通过；项目内 `navigateTo/redirectTo/switchTab` 指向未注册页面扫描结果为 `TOTAL=0`；已新增统一响应解包工具与安全返回工具，阶段 E 导航、回流、解包治理完成 | 仍有部分低频页未迁移到统一工具，但不再构成主链阻塞 | 进入阶段 F，先冻结订阅产品模型与支付状态机 |
| F-1/F-2 冻结 | `.trae/specs/clarify-avatar-product-logic/freeze-subscription-product-model.md` `.trae/specs/clarify-avatar-product-logic/freeze-payment-state-machine.md` | 订阅产品模型与支付状态机已冻结；已明确套餐/权益/支付订单/订阅激活的 canonical 口径，以及 `payment` 模块为唯一支付下单主链 | `F-3/F-4` 代码闭环尚未打通 | 继续执行 F-3 支付后端闭环 |
| F-3 第一轮落地 | `server/src/modules/subscription/subscription.service.ts` | `pnpm validate` 通过；已补齐 `getSubscriptionPlans/getAvatarSubscription/canCreateAvatar/canReceiveOrders/createSubscription` 等服务契约，并把 `getUserSubscription` 返回结构收敛为前端可直接消费的 `subscription + plan + is_active` | 支付回调仍未完成核销与订阅激活；前端订阅页仍未切到 canonical 支付下单接口 | 继续执行 F-3/F-4，打通 payment notify 与订阅页下单闭环 |
| F-3/F-4/F-5 收口 | `server/src/modules/payment/payment.controller.ts` `server/src/modules/subscription/subscription.service.ts` `src/pages/subscription/index.tsx` | `pnpm validate` 通过；`pnpm --filter server build` 通过；支付订单已按 canonical `created -> paying -> paid/closed/failed/refunded` 收口；微信回调已补验签/解密/幂等核销并委托订阅激活；订阅页已切到 `/api/payment/wechat/create` 并改为支付后回拉 `/api/subscription/user` 确认权益 | 真实微信回调联调仍依赖线上支付配置与通知地址可达性，当前未做外部联调 | 进入阶段 G，开始“我的分身”中长期产品能力执行化 |
| G-1/G-2/G-3 任务包冻结 | `.trae/specs/clarify-avatar-product-logic/g1-create-flow-task-pack.md` `.trae/specs/clarify-avatar-product-logic/g2-social-chat-task-pack.md` `.trae/specs/clarify-avatar-product-logic/g3-earnings-transparency-task-pack.md` | 已完成 G 阶段三份可执行任务包：创建流程、心聊社交、收益透明化；每份均补齐 Premise/Constraints/Boundaries/Endgame、阻塞点、开发批次与验收清单；可直接进入下一轮代码实施 | 当前仅完成任务化交付，尚未进入 G 阶段具体代码批次 | 下一步按任务包顺序进入 G-1 最小创建模式与 onboarding 开发 |
