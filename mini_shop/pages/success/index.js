const api = require('../../services/api')
const { payOrder } = require('../../utils/payment')

Page({
  data: { loading: true, paying: false, error: '', order: null },

  onLoad(options) {
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    this.orderNo = options.order_no || ''
    this.token = options.token || ''
    this.loadResult()
  },

  onUnload() {
    if (this.pollTimer) clearTimeout(this.pollTimer)
  },

  async loadResult() {
    if (!this.orderNo || !this.token) {
      this.setData({ loading: false, error: '订单结果参数无效' })
      return
    }
    try {
      const response = await api.getOrderResult(this.orderNo, this.token)
      this.setData({ loading: false, order: response.data })
      if (!response.data.is_paid) this.pollPaymentStatus(0)
    } catch (error) {
      this.setData({ loading: false, error: error.message })
    }
  },

  async pollPaymentStatus(attempt) {
    if (attempt >= 6 || !this.data.order || this.data.order.is_paid) return
    try {
      const response = await api.getPaymentStatus(this.orderNo, this.token)
      if (response.data.is_paid) {
        this.setData({
          'order.is_paid': true,
          'order.payment_status': response.data.payment_status,
          'order.order_status': response.data.order_status
        })
        return
      }
    } catch (error) {
      // 轮询失败不阻断页面，用户仍可主动重新支付。
    }
    this.pollTimer = setTimeout(() => this.pollPaymentStatus(attempt + 1), 1500)
  },

  async retryPayment() {
    if (this.data.paying) return
    this.setData({ paying: true })
    try {
      await payOrder(this.orderNo, this.token)
      wx.showToast({ title: '支付成功', icon: 'success' })
      this.pollPaymentStatus(0)
    } catch (error) {
      wx.showModal({ title: '支付未完成', content: error.message, showCancel: false })
    } finally {
      this.setData({ paying: false })
    }
  },

  openQuery() {
    wx.redirectTo({ url: '../order-query/index' })
  }
})
