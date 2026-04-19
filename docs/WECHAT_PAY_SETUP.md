# 微信支付配置说明

## 前置要求

在使用微信支付功能之前，您需要先在微信支付商户平台完成以下配置：

1. **开通微信支付**
   - 访问 [微信支付商户平台](https://pay.weixin.qq.com/)
   - 注册并开通微信支付功能
   - 获取商户号（mchid）

2. **配置 API 密钥**
   - 登录微信支付商户平台
   - 进入"账户中心 > API安全"
   - 设置 APIv3 密钥（32位字符，包含大小写字母和数字）

3. **下载商户证书**
   - 进入"账户中心 > API安全"
   - 下载商户证书（apiclient_cert.pem 和 apiclient_key.pem）
   - 获取证书序列号（在商户平台显示）

4. **获取平台公钥**
   - 进入"账户中心 > API安全"
   - 获取平台公钥（用于验证签名）
   - 或在商户平台下载平台证书

## 环境变量配置

在项目的 `.env` 文件中配置以下参数：

```bash
# 微信支付配置
WECHAT_PAY_MCHID=1290305501                                    # 商户号
WECHAT_PAY_APIV3_KEY=luyu1985luyu1985luyu1985luyu1985        # APIv3密钥（32位）
WECHAT_PAY_APPID=wx1234567890abcdef                            # 小程序AppID
WECHAT_PAY_SERIAL_NO=YOUR_SERIAL_NUMBER                        # 证书序列号
WECHAT_PAY_NOTIFY_URL=https://yourdomain.com/api/payment/wechat/notify  # 支付结果通知地址

# 微信支付证书（二选一）

## 方式1：直接配置证书内容（推荐）
# 商户私钥（从商户平台下载的 apiclient_key.pem 文件内容，完整包含 BEGIN 和 END）
WECHAT_PAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQD...
...
-----END PRIVATE KEY-----

# 微信平台公钥（从商户平台获取的平台公钥文件内容，可选，用于验证签名）
WECHAT_PAY_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAv...
...
-----END PUBLIC KEY-----

## 方式2：配置证书文件路径（不推荐）
# WECHAT_PAY_PRIVATE_KEY_PATH=/path/to/apiclient_key.pem
# WECHAT_PAY_PUBLIC_KEY_PATH=/path/to/platform_public_key.pem
```

## 证书内容格式说明

### 商户私钥格式

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDExampleContent...
（中间是完整的私钥内容，不要删除或修改）
ExampleContent...EndOfPrivateKey
-----END PRIVATE KEY-----
```

**重要**：
- 必须包含 `-----BEGIN PRIVATE KEY-----` 和 `-----END PRIVATE KEY-----`
- 中间的内容不要删除或修改
- 可以使用反引号（`）包裹，避免换行符问题

### 微信平台公钥格式

```
-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAvExampleContent...
（中间是完整的公钥内容）
ExampleContent...EndOfPublicKey
-----END PUBLIC KEY-----
```

## 测试支付功能

配置完成后，您可以：

1. 重启后端服务
2. 查看日志，确认支付服务初始化成功：
   ```
   [WechatPayService] 微信支付服务初始化完成
   ```

3. 在小程序中测试支付功能：
   - 创建一个订单
   - 点击支付
   - 确认能正常调起微信支付

## 常见问题

### 1. 提示"微信支付服务未初始配置"

**原因**：
- 未配置商户私钥（WECHAT_PAY_PRIVATE_KEY 或 WECHAT_PAY_PRIVATE_KEY_PATH）
- 证书格式不正确

**解决**：
- 确保 `.env` 文件中配置了 `WECHAT_PAY_PRIVATE_KEY`
- 证书内容必须包含 BEGIN 和 END 标记

### 2. 证书格式错误

**原因**：
- 证书内容不完整
- 删除了 BEGIN/END 标记
- 使用了错误的证书文件

**解决**：
- 使用完整的证书内容（包括 BEGIN 和 END）
- 确认使用的是 apiclient_key.pem 文件（商户私钥）

### 3. 支付接口调用失败

**原因**：
- APIv3密钥不正确
- 证书序列号不匹配
- AppID配置错误

**解决**：
- 检查 `WECHAT_PAY_APIV3_KEY` 是否正确（32位）
- 检查 `WECHAT_PAY_SERIAL_NO` 是否与商户平台一致
- 检查 `WECHAT_PAY_APPID` 是否与小程序一致

### 4. 平台公钥不配置会怎样？

平台公钥用于验证微信支付结果通知的签名，如果未配置：
- 支付功能仍然可用
- 但无法验证通知签名的有效性
- 建议在生产环境中配置

## 安全建议

1. **不要将证书提交到版本控制系统**
   - 将 `.env` 文件添加到 `.gitignore`
   - 不要将证书内容泄露

2. **定期更新证书**
   - 微信支付证书有有效期（通常1年）
   - 到期前需要重新下载并更新配置

3. **使用测试账号**
   - 在开发环境中使用微信支付沙箱环境
   - 测试通过后再切换到生产环境

## 联系支持

如果遇到其他问题，请联系技术支持或查看微信支付官方文档：
- [微信支付文档](https://pay.weixin.qq.com/wiki/doc/api/index.html)
- [微信支付开发文档](https://pay.weixin.qq.com/wiki/doc/apiv3/index.shtml)
