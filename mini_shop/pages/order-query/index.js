const api = require('../../services/api')

Page({
  data: {
    querying: false,
    searched: false,
    error: '',
    orders: []
  },

  onLoad() {
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
  },

  async queryOrders(event) {
    const receiverName = (event.detail.value.receiver_name || '').trim()
    const phone = (event.detail.value.phone || '').trim()
    if (!receiverName || !phone) {
      wx.showToast({ title: '请填写姓名和手机号', icon: 'none' })
      return
    }
    this.setData({ querying: true, error: '', orders: [] })
    try {
      const response = await api.queryOrders(receiverName, phone)
      const source = Array.isArray(response.data) ? response.data : []
      const orders = source.map(order => Object.assign({}, order, {
        timeline: Array.isArray(order.timeline) ? order.timeline : []
      }))
      this.setData({ searched: true, orders })
    } catch (error) {
      this.setData({ searched: true, orders: [], error: error.message || '查询失败，请稍后重试' })
    } finally {
      this.setData({ querying: false })
    }
  }
})
