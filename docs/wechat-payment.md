# 微信支付配置指南

本文档说明如何为小程序配置微信支付功能。

## 前提条件

1. 已注册微信小程序账号
2. 已开通微信支付功能
3. 已获取以下信息：
   - 商户号 (mchid)
   - API 密钥 (API Key)
   - 商户证书（APIv3 需要）

## 配置步骤

### 1. 添加环境变量

在项目根目录创建 `.env` 文件（开发环境）或配置生产环境变量：

```env
# 微信小程序配置
WECHAT_APPID=your_appid_here

# 微信支付配置
WECHAT_PAY_MCHID=your_mchid_here
WECHAT_PAY_SERIAL_NO=your_serial_no_here
WECHAT_PAY_PRIVATE_KEY_PATH=./certs/apiclient_key.pem
WECHAT_PAY_PUBLIC_KEY_PATH=./certs/wechatpay_public_key.pem
WECHAT_PAY_APIV3_KEY=your_api_key_here
WECHAT_PAY_NOTIFY_URL=https://your-domain.com/api/payment/wechat/notify
```

**重要提示**：
- 如果未配置 `WECHAT_PAY_PRIVATE_KEY_PATH` 或 `WECHAT_PAY_PUBLIC_KEY_PATH`，支付服务将无法初始化，支付功能将不可用
- 请确保配置了所有必需的证书文件路径

### 2. 获取商户证书

1. 登录 [微信支付商户平台](https://pay.weixin.qq.com/)
2. 进入「账户中心」→「API 安全」
3. 下载商户证书（包含 apiclient_key.pem 和 apiclient_cert.pem）
4. 从证书中提取证书序列号（serial_no）
5. 获取微信平台公钥（用于验证签名）
6. 将证书文件放到项目根目录的 `certs/` 目录下
7. 确保证书文件路径与 `WECHAT_PAY_PRIVATE_KEY_PATH` 和 `WECHAT_PAY_PUBLIC_KEY_PATH` 环境变量一致

**证书序列号获取方法**：
```bash
openssl x509 -in apiclient_cert.pem -noout -serial
# 输出示例：serial=1A2B3C4D5E6F...
# 去掉 "serial=" 前缀即为证书序列号
```

### 3. 配置小程序支付

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入「开发」→「开发管理」→「接口设置」
3. 找到「微信支付」，点击「开通」
4. 绑定商户号
5. 配置支付授权目录（小程序不需要）

## 使用说明

### 订阅套餐支付流程

1. 用户选择订阅套餐
2. 前端调用 `/api/subscription/create-order` 创建订单
3. 前端使用返回的支付参数调用 `Taro.requestPayment`
4. 用户完成支付
5. 前端调用 `/api/subscription/payment-callback` 获取支付结果
6. 自动更新用户订阅状态

### API 接口说明

#### 创建订单

```typescript
POST /api/subscription/create-order
Request: {
  planId: string,      // 套餐ID
  duration: number     // 订阅时长（月）
}
Response: {
  orderId: string,
  paymentParams: {
    timeStamp: string,
    nonceStr: string,
    package: string,
    signType: string,
    paySign: string
  }
}
```

#### 支付回调

```typescript
POST /api/subscription/payment-callback
Request: {
  orderId: string
}
Response: {
  success: boolean,
  subscription: {
    id: string,
    planId: string,
    startDate: string,
    endDate: string,
    status: 'active' | 'expired' | 'cancelled'
  }
}
```

## 测试支付

### 微信支付沙箱环境

微信支付提供沙箱环境用于测试：

1. 在商户平台开通沙箱
2. 使用沙箱商户号和 API 密钥
3. 使用沙箱证书
4. 测试完成后切换到生产环境

### 注意事项

- 沙箱环境需要使用真实的 openid
- 沙箱支付的金额会自动原路退款
- 测试完成后记得切换环境变量

## 常见问题

### 1. 支付失败：「支付签名错误」

检查：
- `WECHAT_API_KEY` 是否正确
- 商户证书是否正确加载
- 时间戳、随机串等参数是否正确

### 2. 支付失败：「商户号不存在」

检查：
- `WECHAT_MCHID` 是否正确
- 小程序是否正确绑定了商户号

### 3. 支付失败：「订单不存在」

检查：
- 订单是否已创建
- 订单状态是否正确（应为 `pending`）

### 4. 支付成功但订阅状态未更新

检查：
- 支付回调接口是否正确调用
- 数据库中订单状态是否更新为 `paid`
- 用户订阅表是否正确创建/更新

## 安全建议

1. **环境变量安全**
   - 不要将 `.env` 文件提交到版本控制
   - 生产环境使用安全的密钥管理服务

2. **证书安全**
   - 不要将证书文件提交到版本控制
   - 定期更新证书
   - 限制证书文件访问权限

3. **回调验证**
   - 验证回调来源的真实性
   - 检查回调数据的完整性

## 相关文档

- [微信支付官方文档](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)
- [微信小程序支付文档](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/payment/wx.requestPayment.html)
- [微信支付 APIv3 文档](https://pay.weixin.qq.com/wiki/doc/apiv3/wechatpay/wechatpay4_0.shtml)
