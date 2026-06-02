# 莫瑞娜登录流程全链路复盘

## 一、当前架构

### 登录方式

| 方式 | 入口 | 流程 | 适用端 |
|------|------|------|--------|
| 手机验证码 | 登录页-账号登录Tab | 输入手机号→发验证码→验证→登录/注册 | 全端 |
| 微信手机号授权 | 登录页-微信登录Tab | 点"授权登录"→微信getPhoneNumber→后端换手机号→登录/注册 | 仅小程序 |
| 微信静默登录 | app.tsx未实现 | wx.login拿code→后端换openid→静默登录 | 仅小程序（未实现） |

### 登录状态保存

```
前端：Taro.getStorageSync('token') + Taro.getStorageSync('userInfo')
      ↓ zustand store: { token, userInfo, isLoggedIn }
      
后端：自研JWT（非标准JWT）
      格式：base64(payload).hmac-sha256签名
      payload：{ userId, iat: Date.now() }
      过期：7天（硬编码）
      密钥：JWT_SECRET || "morena-secret-key"（.env未配置JWT_SECRET，用的硬编码默认值）
```

### 登录检查

```
前端：每个请求自动带 X-User-Id + Authorization: Bearer <token>
后端：没有任何Guard/中间件校验！
      - 所有Controller直接 @Headers('x-user-id') userId 拿用户ID
      - 没有验证token是否有效
      - 没有验证x-user-id是否跟token匹配
      - /api/auth/me 是唯一验证token的接口，但没人调它
```

---

## 二、逐层拆问题

### 🔴 P0 — 安全漏洞（必须修）

| # | 问题 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | **任何人可以伪造x-user-id访问别人数据** | 🔴致命 | 后端所有接口都从x-user-id取用户ID，前端传什么就是什么，没有校验token和userId的对应关系。攻击者只需改header就能冒充任何用户 |
| 2 | **JWT密钥硬编码** | 🔴致命 | .env没有JWT_SECRET，代码用的是"morena-secret-key"。攻击者可以用这个密钥伪造任意用户的token |
| 3 | **验证码存储在内存Map** | 🔴严重 | codeCache是进程内存，重启丢失、多实例不共享、无容量上限，可被OOM攻击 |
| 4 | **开发模式直接返回验证码** | 🔴严重 | 未配置阿里云密钥时返回isDev=true+验证码明文，线上也走这个逻辑 |

### 🟡 P1 — 逻辑缺陷（应该修）

| # | 问题 | 说明 |
|---|------|------|
| 5 | **微信登录和手机号登录是两套独立用户体系** | wechatLogin创建openid用户，phoneLogin创建phone用户，wechatPhoneLogin用手机号匹配但openid覆盖逻辑不清晰。同一用户微信授权手机号登录可能创建两个账号 |
| 6 | **token过期后无续期机制** | 7天硬编码过期，过期后用户被踢出，没有refreshToken，没有无感续期 |
| 7 | **auth错误处理被注释掉了** | network.ts中handleAuthError的跳转登录页逻辑全被注释，token过期后用户看到的是接口报错，而不是跳转登录 |
| 8 | **loadUserFromStorage不验证token有效性** | app启动时从storage加载token/userInfo直接设isLoggedIn=true，但没调/auth/me验证token是否还有效 |
| 9 | **wechatPhoneLogin的code和phoneCode关系不清晰** | code是wx.login的code换openid，phoneCode是getPhoneNumber的code换手机号，但后端实现里两步都需要调微信API，错误处理不完整 |

### 🟢 P2 — 体验问题（可以优化）

| # | 问题 | 说明 |
|---|------|------|
| 10 | **微信授权登录需要两步** | 先点getPhoneNumber，然后后端还要拿wx.login的code。但前端代码里没有先调wx.login，wechatPhoneLogin的code参数从哪来？ |
| 11 | **新用户注册后要手动完善资料** | 弹出资料完善面板，但可以跳过，跳过后昵称是"用户XXXX"，头像是灰色 |
| 12 | **没有自动登录/静默登录** | 每次打开小程序都要手动登录，wx.login的静默登录能力没用 |
| 13 | **验证码60秒倒计时但5分钟过期** | 倒计时60秒可重发，但验证码5分钟过期，用户等很久再输入还能用，这倒是合理的，但边界case没处理 |
| 14 | **邀请码只在登录页输入** | 没有在分享链接/扫码场景自动填充的完整流程 |

---

## 三、完整流程图（当前 vs 应该）

### 当前流程

```
用户打开小程序
  → app.tsx: loadUserFromStorage() 
  → 从storage读token+userInfo 
  → 直接设isLoggedIn=true（不验证）
  → 进入页面
  
页面请求API
  → network.ts: 自动带X-User-Id + Authorization
  → 后端: 直接从X-User-Id取userId（不校验！）
  → 返回数据

token过期（7天后）
  → 后端verifyToken返回null
  → 但后端没有Guard，这个校验根本不执行
  → 请求仍然成功（因为X-User-Id是前端传的）
  
结论：token形同虚设，X-User-Id才是唯一的"鉴权"
```

### 应该的流程

```
用户打开小程序
  → app.tsx: loadUserFromStorage()
  → 从storage读token+userInfo
  → 调 /api/auth/me 验证token有效性
  → 有效：设isLoggedIn=true
  → 无效：清除storage，跳转登录页

微信自动登录
  → wx.login() 获取code
  → 调 /api/auth/wechat-login 换openid
  → 已注册：直接登录，返回token
  → 未注册：跳转登录页，提示绑定手机号

页面请求API
  → network.ts: 只带Authorization: Bearer <token>
  → 后端Guard: 解析token，提取userId
  → 将userId注入Request对象
  → Controller从Request取userId，不信任前端传的

token快过期
  → 后端返回新token在响应头
  → 前端自动更新storage
  → 用户无感知续期

token已过期
  → 后端返回401
  → 前端清除storage，跳转登录页
  → 支持redirect参数回到原页面
```

---

## 四、修复优先级

### 第一优先（安全）：建立真正的鉴权

1. **后端加全局AuthGuard** — 解析token，提取userId，拒绝无效请求
2. **移除X-User-Id信任** — 所有Controller从Guard注入的userId取值，不信任header
3. **JWT_SECRET配置到.env** — 每个环境用不同的密钥
4. **验证码改Redis存储** — 替代内存Map

### 第二优先（体验）：自动登录

5. **app启动时调/auth/me验证** — 不盲目信任storage
6. **微信静默登录** — wx.login→后端查openid→已注册直接登录
7. **token续期机制** — 快过期时自动换新token
8. **启用handleAuthError** — 取消注释，401时跳转登录页

### 第三优先（完善）：账号体系

9. **统一账号体系** — 手机号为主键，微信openid为关联字段，一个手机号=一个账号
10. **refreshToken** — 长期有效，用于换取短期accessToken
11. **登录设备管理** — 记录登录设备，支持踢出

---

## 五、关键代码位置

| 文件 | 作用 | 需改 |
|------|------|------|
| server/src/modules/auth/auth.service.ts | JWT生成/验证、登录逻辑 | ✅ 重构 |
| server/src/modules/auth/auth.controller.ts | 登录接口 | ✅ 加token续期 |
| server/src/modules/auth/sms.service.ts | 短信发送 | ✅ 验证码改Redis |
| server/src/main.ts | 全局配置 | ✅ 注册Guard |
| src/network.ts | 前端请求封装 | ✅ 启用auth错误处理 |
| src/stores/user.ts | 用户状态管理 | ✅ 加token验证 |
| src/pages/login/index.tsx | 登录页面 | ✅ 加静默登录 |
| src/app.tsx | 启动入口 | ✅ 加token校验 |
