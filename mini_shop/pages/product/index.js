const api = require('../../services/api')
const { parseScene } = require('../../utils/scene')
const { payOrder } = require('../../utils/payment')

Page({
  data: {
    loading: true,
    submitting: false,
    error: '',
    publicCode: '',
    product: null,
    gallery: [],
    specGroups: [],
    selectedSku: null,
    displayPrice: '0.00',
    quantity: 1,
    addressType: 'domestic',
    region: [],
    regionText: '请选择省 / 市 / 区'
  },

  onLoad(options) {
    wx.hideShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    const publicCode = parseScene(options)
    if (!publicCode) {
      this.setData({ loading: false, error: '无效的商品二维码，请重新扫描' })
      return
    }
    this.setData({ publicCode })
    this.loadProduct()
  },

  async loadProduct() {
    this.setData({ loading: true, error: '' })
    try {
      const response = await api.getProduct(this.data.publicCode)
      const product = response.data
      const specGroups = Object.keys(product.spec_definition || {}).map(name => ({
        name,
        values: product.spec_definition[name].map(value => ({ value, selected: false }))
      }))
      this.setData({
        loading: false,
        product,
        gallery: product.gallery || [],
        specGroups,
        displayPrice: product.price_min === product.price_max
          ? product.price_min
          : `${product.price_min}～${product.price_max}`,
        quantity: product.min_quantity || 1
      })
      if (!specGroups.length && product.skus.length === 1) {
        this.setSku(product.skus[0])
      }
    } catch (error) {
      this.setData({ loading: false, error: error.message })
    }
  },

  selectSpec(event) {
    const groupIndex = Number(event.currentTarget.dataset.groupIndex)
    const value = event.currentTarget.dataset.value
    const groups = this.data.specGroups.map((group, index) => ({
      ...group,
      values: group.values.map(item => ({
        ...item,
        selected: index === groupIndex ? item.value === value : item.selected
      }))
    }))
    this.setData({ specGroups: groups })
    const selected = {}
    groups.forEach(group => {
      const item = group.values.find(valueItem => valueItem.selected)
      if (item) selected[group.name] = item.value
    })
    const sku = this.data.product.skus.find(item =>
      Object.keys(item.spec).every(key => selected[key] === item.spec[key])
    )
    this.setSku(sku || null)
  },

  setSku(sku) {
    const baseGallery = this.data.product ? this.data.product.gallery || [] : []
    this.setData({
      selectedSku: sku,
      displayPrice: sku ? sku.price : this.data.product.price_min,
      gallery: sku && sku.image ? [sku.image, ...baseGallery.filter(url => url !== sku.image)] : baseGallery
    })
  },

  changeQuantity(event) {
    const min = this.data.product.min_quantity || 1
    const max = this.data.product.max_quantity || (this.data.selectedSku ? this.data.selectedSku.stock : 9999)
    const value = Math.max(min, Math.min(max, Number(event.detail.value) || min))
    this.setData({ quantity: value })
  },

  changeAddressType(event) {
    this.setData({ addressType: event.currentTarget.dataset.type })
  },

  changeRegion(event) {
    const region = event.detail.value || []
    this.setData({ region, regionText: region.join(' ') })
  },

  async submitOrder(event) {
    const product = this.data.product
    const sku = this.data.selectedSku
    if (!sku) {
      wx.showToast({ title: '请选择完整规格', icon: 'none' })
      return
    }
    if (sku.stock < this.data.quantity) {
      wx.showToast({ title: '商品库存不足', icon: 'none' })
      return
    }
    const values = event.detail.value
    if (!values.receiver_name || !values.phone) {
      wx.showToast({ title: '请填写收货人和手机号', icon: 'none' })
      return
    }
    const isDelivery = product.delivery_type === '快递配送'
    if (isDelivery && this.data.addressType === 'domestic' && this.data.region.length !== 3) {
      wx.showToast({ title: '请选择省市区', icon: 'none' })
      return
    }
    const payload = {
      public_code: product.public_code,
      sku_id: sku.id,
      quantity: this.data.quantity,
      receiver_name: values.receiver_name,
      phone: values.phone,
      address_type: this.data.addressType,
      province: this.data.region[0] || '',
      city: this.data.region[0] && this.data.region[0].endsWith('市') && this.data.region[1] === this.data.region[0]
        ? '市辖区'
        : (this.data.region[1] || ''),
      district: this.data.region[2] || '',
      overseas_country: values.overseas_country || '',
      overseas_region: values.overseas_region || '',
      overseas_city: values.overseas_city || '',
      detail_address: values.detail_address || '',
      buyer_remark: values.buyer_remark || '',
      promotion_code: '',
      submit_token: product.submit_token
    }
    this.setData({ submitting: true })
    try {
      const response = await api.createOrder(payload)
      const result = response.data
      try {
        await payOrder(result.order_no, result.result_token)
      } catch (paymentError) {
        wx.showToast({ title: paymentError.message, icon: 'none', duration: 2200 })
      }
      wx.redirectTo({
        url: `../success/index?order_no=${encodeURIComponent(result.order_no)}&token=${encodeURIComponent(result.result_token)}`
      })
    } catch (error) {
      wx.showModal({ title: '订单提交失败', content: error.message, showCancel: false })
      if (/重复提交/.test(error.message)) this.loadProduct()
    } finally {
      this.setData({ submitting: false })
    }
  },

  openOrderQuery() {
    wx.navigateTo({ url: '../order-query/index' })
  }
})
