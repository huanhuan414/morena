const api = require('../services/api')

function loginCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      success(result) {
        if (result.code) resolve(result.code)
        else reject(new Error('未能获取微信登录凭证'))
      },
      fail(error) {
        reject(new Error(error.errMsg || '微信登录失败'))
      }
    })
  })
}

function requestPayment(params) {
  return new Promise((resolve, reject) => {
    wx.requestPayment(Object.assign({}, params, {
      success: resolve,
      fail(error) {
        const cancelled = /cancel/i.test(error.errMsg || '')
        const failure = new Error(cancelled ? '你已取消支付，可稍后继续付款' : (error.errMsg || '微信支付失败'))
        failure.cancelled = cancelled
        reject(failure)
      }
    }))
  })
}

async function payOrder(orderNo, resultToken) {
  const code = await loginCode()
  const response = await api.createPrepay(orderNo, resultToken, code)
  if (response.data && response.data.already_paid) return { alreadyPaid: true }
  await requestPayment(response.data)
  return { paid: true }
}

module.exports = { payOrder }
