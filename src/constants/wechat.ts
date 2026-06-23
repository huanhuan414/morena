/**
 * 微信小程序订阅消息模板ID配置
 * @description 集中管理所有微信订阅消息模板ID
 */

export const WX_SUBSCRIBE_TEMPLATES = {
  /** 反馈提交通知 - 发送给发单用户 */
  FEEDBACK: '-VTG3Z8UjJACUEENlhL5jhJ42X_us7-SZzuN-EWPtBA',
}

export type WxSubscribeTemplateKey = keyof typeof WX_SUBSCRIBE_TEMPLATES