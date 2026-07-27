# 小程序购物 API 接口说明

接口根地址：

```text
https://shop.51webjs.com/api/mini-shop
```

本接口只服务于 `mini_shop` 独立分包。商品价格、库存、上下架状态和订单金额均由服务器重新校验，小程序提交的金额不会作为下单依据。

## 1. 获取商品购买信息

```http
GET /products/{public_code}
```

返回商品轮播图、详情图片、规格、可售 SKU、库存、配送说明、售后说明和下单令牌。

只有处于“上架”状态且商户正常的商品可以访问；不可购买时返回 `404`。

## 2. 创建订单

```http
POST /orders
Content-Type: application/json
```

请求示例：

```json
{
  "public_code": "0RahZizOHELU1NJe48Rwqw",
  "sku_id": 1,
  "quantity": 1,
  "submit_token": "商品接口返回的令牌",
  "receiver_name": "张三",
  "phone": "13800138000",
  "address_type": "domestic",
  "province": "广东省",
  "city": "广州市",
  "district": "天河区",
  "detail_address": "体育西路 1 号",
  "buyer_remark": ""
}
```

海外地址将 `address_type` 改为 `overseas`，并提交：

```json
{
  "overseas_country": "新加坡",
  "overseas_region": "中区",
  "overseas_city": "新加坡",
  "detail_address": "完整海外收货地址"
}
```

成功后返回订单号、订单金额和临时结果令牌。重复提交、库存不足、商品下架或 SKU 不可售时会返回明确错误信息。

## 3. 获取订单提交结果

```http
GET /orders/{order_no}/result?token={result_token}
```

结果令牌由创建订单接口返回，有效期为 24 小时，仅用于订单提交成功页。

## 4. 创建微信预支付单

```http
POST /orders/{order_no}/prepay
Content-Type: application/json
```

请求示例：

```json
{
  "result_token": "创建订单接口返回的结果令牌",
  "login_code": "wx.login 返回的临时 code"
}
```

服务器使用 `login_code` 换取可信 OpenID，并向微信支付创建 JSAPI 预支付单。成功后返回 `wx.requestPayment` 所需的 `timeStamp`、`nonceStr`、`package`、`signType` 和 `paySign`。

## 5. 查询支付状态

```http
GET /orders/{order_no}/payment-status?token={result_token}
```

支付成功页使用此接口轮询服务器已经确认的支付状态。客户端的 `wx.requestPayment success` 不能代替服务器支付回调。

## 6. 微信支付异步通知

```http
POST /payments/notify
```

该地址由微信支付服务器调用。服务器会验证微信支付签名、解密通知，并核对 AppID、商户号、币种、订单号和支付金额，验证通过后将订单更新为“已支付、待发货”。

## 7. 按收货信息查询订单

```http
POST /order-query
Content-Type: application/json
```

请求示例：

```json
{
  "receiver_name": "张三",
  "phone": "13800138000"
}
```

姓名和手机号必须同时完全匹配。接口返回最近的匹配订单、状态、物流单号和物流时间线；没有匹配订单时返回空数组，不会产生 HTTP 404。

## 8. 获取单个订单物流

可使用订单结果令牌查询：

```http
GET /orders/{order_no}/logistics?token={result_token}
```

也可以使用收货人信息查询：

```http
GET /orders/{order_no}/logistics?receiver_name=张三&phone=13800138000
```

## 通用返回格式

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "message": "错误原因"
}
```

常见状态码：

- `400`：参数错误或业务校验失败
- `403`：订单查询凭据无效
- `404`：商品或订单不存在
- `500`：服务器内部错误

## 小程序码接口

后台登录后，在商品列表或商品详情页点击“下载小程序码”：

```http
GET /products/{product_id}/mini-qrcode
```

服务器会调用微信接口生成带商品 `public_code` 场景参数的小程序码，扫码后进入：

```text
mini_shop/pages/product/index
```

商品详情配置页也提供“生成并预览小程序码”功能，对应后台接口：

```http
POST /products/{product_id}/mini-qrcode/generate
```

该接口受后台登录、商品管理权限和 CSRF 校验保护，成功后返回可直接预览和下载的 PNG 图片数据。

正式环境需要配置：

```env
WECHAT_MINI_APP_ID=小程序AppID
WECHAT_MINI_APP_SECRET=小程序AppSecret
WECHAT_MINI_ENV_VERSION=release
WECHAT_MINI_CHECK_PATH=true
```
