const { API_BASE_URL } = require('../config')

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${API_BASE_URL}${path}`,
      method: options.method || 'GET',
      data: options.data || {},
      timeout: 15000,
      header: {
        'content-type': 'application/json',
        ...(options.header || {})
      },
      success(response) {
        const payload = response.data || {}
        if (response.statusCode >= 200 && response.statusCode < 300 && payload.ok) {
          resolve(payload)
          return
        }
        reject(new Error(payload.message || `请求失败（${response.statusCode}）`))
      },
      fail(error) {
        reject(new Error(error.errMsg || '网络连接失败，请稍后重试'))
      }
    })
  })
}

module.exports = {
  getProduct(publicCode) {
    return request(`/products/${encodeURIComponent(publicCode)}`)
  },
  createOrder(data) {
    return request('/orders', { method: 'POST', data })
  },
  getOrderResult(orderNo, token) {
    return request(`/orders/${encodeURIComponent(orderNo)}/result?token=${encodeURIComponent(token)}`)
  },
  createPrepay(orderNo, resultToken, loginCode) {
    return request(`/orders/${encodeURIComponent(orderNo)}/prepay`, {
      method: 'POST',
      data: { result_token: resultToken, login_code: loginCode }
    })
  },
  getPaymentStatus(orderNo, token) {
    return request(`/orders/${encodeURIComponent(orderNo)}/payment-status?token=${encodeURIComponent(token)}`)
  },
  queryOrders(receiverName, phone) {
    return request('/order-query', {
      method: 'POST',
      data: { receiver_name: receiverName, phone }
    })
  },
  getLogistics(orderNo, credentials = {}) {
    const query = credentials.token
      ? `token=${encodeURIComponent(credentials.token)}`
      : `receiver_name=${encodeURIComponent(credentials.receiverName || '')}&phone=${encodeURIComponent(credentials.phone || '')}`
    return request(`/orders/${encodeURIComponent(orderNo)}/logistics?${query}`)
  }
}
