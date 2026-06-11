/**
 * 邀请好友奖励配置 — 全局唯一真相源
 *
 * 设计原则：
 * 1. 所有前后端关于邀请奖励的文案/数值，必须引用此文件
 * 2. 禁止在任何页面/接口中硬编码奖励数值
 * 3. 修改奖励只需改此文件，自动同步全端
 *
 * 奖励策略（从产品运营角度）：
 * - 现金奖励比托管时长更有感知力（用户对"钱"最敏感）
 * - 双方奖励对等，降低邀请心理门槛
 * - 阶梯奖励刺激持续邀请
 * - 条件"创建分身"确保新用户体验核心功能
 */

/** 邀请人（老用户）基础奖励，单位：元 */
export const INVITER_BASE_REWARD = 5

/** 被邀请人（新用户）基础奖励，单位：元 */
export const INVITEE_BASE_REWARD = 5

/** 奖励发放条件：新用户需完成的行为 */
export const REWARD_CONDITION = '创建分身'

/** 阶梯奖励配置：累计邀请达到指定人数，额外奖励 */
export const REFERRAL_MILESTONES = [
  { count: 3, bonus: 5, label: '满3人' },
  { count: 5, bonus: 10, label: '满5人' },
  { count: 10, bonus: 20, label: '满10人' },
] as const

/** 首页快捷功能标签文案 */
export const QUICK_ACTION_TAG = `邀请好友`

/** Banner 主标题 */
export const BANNER_TITLE = `邀请好友一起体验Morena AI 领现金大奖`

/** Banner 副标题模板（传入已邀请人数） */
export const BANNER_DESC = (invitedCount: number) =>
  `注册得现金+充值返佣+积分奖励，多邀多得！已邀请 ${invitedCount} 人`

/** 邀请中心头部副标题 */
export const REFERRAL_HEADER_DESC = `邀请好友一起体验Morena AI`

/** 步骤3标题 */
export const STEP3_TITLE = `邀请成功`

/** 步骤3描述 */
export const STEP3_DESC = '邀请越多，好友越多'

/** 阶梯奖励描述 */
export const MILESTONE_DESC = ''

/** 数据库 reward_amount 单位转换（元 → 分，用于存储整数） */
export const REWARD_YUAN_TO_CENTS = (yuan: number) => Math.round(yuan * 100)
export const REWARD_CENTS_TO_YUAN = (cents: number) => cents / 100
