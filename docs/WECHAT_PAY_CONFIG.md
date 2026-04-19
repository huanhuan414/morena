# 微信支付配置说明 - 完整版

## 问题原因

当前错误："微信支付服务未初始化，请检查配置"

**原因**：
1. `WECHAT_PAY_PRIVATE_KEY`（商户私钥）未配置
2. `WECHAT_PAY_APPID` 和 `WECHAT_PAY_SERIAL_NO` 是示例值，不是真实值
3. 缺少必需的证书和密钥

---

## 必需的配置信息

根据微信支付官方文档，您需要获取以下信息：

### 1. 基本信息必需项

| 配置项 | 说明 | 获取位置 | 示例 |
|--------|------|----------|------|
| `WECHAT_PAY_MCHID` | 商户号 | 商户平台首页 | 1290305501 |
| `WECHAT_PAY_APIV3_KEY` | APIv3密钥（32位） | 账户中心 > API安全 > API安全 > APIv3密钥 | luyu1985luyu1985luyu1985luyu1985 |
| `WECHAT_PAY_APPID` | 小程序AppID | 微信公众平台 | wx1234567890abcdef |
| `WECHAT_PAY_SERIAL_NO` | 证书序列号 | 账户中心 > API安全 > API证书 | 1ABCDEF1234567890 |
| `WECHAT_PAY_NOTIFY_URL` | 支付结果通知地址 | 您的服务器域名 | https://yourdomain.com/api/payment/wechat/notify |

### 2. 证书必需项

| 配置项 | 说明 | 获取位置 |
|--------|------|----------|
| `WECHAT_PAY_PRIVATE_KEY` | 商户私钥 | 账户中心 > API安全 > API证书 > 下载证书（apiclient_key.pem） |
| `WECHAT_PAY_PUBLIC_KEY` | 平台公钥（可选） | 账户中心 > API安全 > API安全 > 平台证书 |

---

## 配置步骤

### 步骤1：登录微信支付商户平台

访问：https://pay.weixin.qq.com/

### 步骤2：获取小程序 AppID

1. 登录 [微信公众平台](https://mp.weixin.qq.com/)
2. 进入"开发 > 开发管理 > 开发设置"
3. 复制"开发者ID（AppID）"

```
示例：wx1234567890abcdef
```

### 步骤3：获取 APIv3 密钥

1. 登录微信支付商户平台
2. 进入"账户中心 > API安全"
3. 点击"API安全 > APIv3密钥"
4. 设置APIv3密钥（32位字符，包含大小写字母和数字）

```
示例：luyu1985luyu1985luyu1985luyu1985
```

### 步骤4：下载商户证书

1. 在"账户中心 > API安全"中
2. 点击"API证书"
3. 下载证书文件（apiclient_key.pem）
4. 打开文件，复制完整内容（包括 BEGIN 和 END）

```
证书格式：
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD...
（中间是完整的私钥内容）
...EndOfPrivateKey
-----END PRIVATE KEY-----
```

### 步骤5：获取证书序列号

1. 在"账户中心 > API安全 > API证书"中
2. 查看证书序列号（16位或20位字符串）

```
示例：1ABCDEF1234567890
```

### 步骤6：获取平台公钥（可选但推荐）

1. 在"账户中心 > API安全"中
2. 点击"API安全 > 平台证书"
3. 获取平台公钥内容

```
格式：
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv...
-----END PUBLIC KEY-----
```

### 步骤7：配置 .env 文件

打开 `/workspace/projects/.env` 文件，填写以下内容：

```bash
# 微信支付配置
WECHAT_PAY_MCHID=您的商户号（如：1290305501）
WECHAT_PAY_APIV3_KEY=您的APIv3密钥（32位）
WECHAT_PAY_APPID=您的小程序AppID
WECHAT_PAY_SERIAL_NO=您的证书序列号
WECHAT_PAY_NOTIFY_URL=https://您的域名/api/payment/wechat/notify

# 微信支付证书（必需）
WECHAT_PAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
您的商户私钥内容（完整复制）
-----END PRIVATE KEY-----

# 微信支付证书（可选但推荐）
WECHAT_PAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
您的平台公钥内容（完整复制）
-----END PUBLIC KEY-----
```

**重要提示**：
- ✅ 商户私钥必须包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
- ✅ 中间的内容不要删除或修改
- ✅ 可以使用反引号（`）包裹，避免换行符问题

### 步骤8：重启服务

服务会自动重启，您应该看到以下日志：

```
[WechatPayService] 开始初始化微信支付服务 {
  hasPrivateKeyPath: false,
  hasPublicKeyPath: false,
  hasPrivateKeyContent: true,    // ← 这里应该是 true
  hasPublicKeyContent: true      // ← 配置后也是 true
}
[WechatPayService] 微信支付服务初始化完成 {
  mchid: '您的商户号',
  appid: '您的小程序AppID',
  isAvailable: true
}
```

---

## 配置示例（完整）

```bash
# 微信支付配置
WECHAT_PAY_MCHID=1290305501
WECHAT_PAY_APIV3_KEY=luyu1985luyu1985luyu1985luyu1985
WECHAT_PAY_APPID=wx1234567890abcdef
WECHAT_PAY_SERIAL_NO=1ABCDEF1234567890
WECHAT_PAY_NOTIFY_URL=https://morina-ai.com/api/payment/wechat/notify

# 微信支付证书
WECHAT_PAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDExampleKeyContent
ExampleKeyContentExampleKeyContentExampleKeyContentExampleKeyContent
ExampleKeyContentExampleKeyContentExampleKeyContentExampleKeyContent
ExampleKeyContentExampleKeyContentExampleKeyContentExampleKeyContent
-----END PRIVATE KEY-----

WECHAT_PAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvExampleKeyContent
ExampleKeyContentExampleKeyContentExampleKeyContentExampleKeyContent
ExampleKeyContentExampleKeyContentExampleKeyContentExampleKeyContent
-----END PUBLIC KEY-----
```

---

## 暂时不需要支付功能

如果您暂时不需要支付功能，可以创建"免付费"订单：

1. 在创建订单时，将**预算设置为 0**
2. 订单会直接进入"开放接单"状态，无需支付
3. 其他所有功能都正常使用

---

## 常见问题

### Q1: 商户私钥在哪里下载？

A: 登录微信支付商户平台 > 账户中心 > API安全 > API证书 > 下载证书

### Q2: APIv3 密钥是什么？

A: 是微信支付APIv3版本的密钥，用于请求签名和响应验签。32位字符，包含大小写字母和数字。

### Q3: 证书序列号在哪里查看？

A: 在商户平台的"账户中心 > API安全 > API证书"页面中显示。

### Q4: 平台公钥必须配置吗？

A: 不是必须的，但强烈推荐。用于验证微信支付结果通知的签名，确保通知的真实性。

### Q5: 支付结果通知地址是什么？

A: 是您的服务器接收微信支付结果通知的地址。例如：
```
https://yourdomain.com/api/payment/wechat/notify
```

### Q6: 测试环境如何配置？

A: 微信支付提供沙箱环境，可以使用沙箱商户号和密钥进行测试。详细配置请参考微信支付沙箱文档。

---

## 获取帮助

如果遇到问题，请参考：

1. **微信支付官方文档**：https://pay.weixin.qq.com/doc/v3/
2. **微信支付开发文档**：https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml
3. **微信支付技术支持**：商户平台 > 客服中心

---

## 下一步

完成配置后：

1. 重启服务（自动）
2. 查看日志，确认服务初始化成功
3. 创建订单，测试支付功能

---

**祝您配置顺利！** 🎉
