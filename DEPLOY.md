# AI分身平台 - 部署指南

## 一、前端部署（H5）

### 1. 构建前端产物
```bash
cd /workspace/projects

# 构建H5版本
pnpm build:web

# 构建产物位置
# /workspace/projects/dist-web/
#   ├── index.html      # 入口文件
#   ├── js/             # JS文件
#   ├── css/            # CSS文件
#   └── pages/          # 页面资源
```

### 2. 部署到Nginx
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/ai-avatar/dist-web;
    index index.html;

    # 处理SPA路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 3. 或使用简单的Node服务
```bash
# 安装serve
npm install -g serve

# 启动服务
serve -s dist-web -l 80
```

---

## 二、后端部署

### 1. 构建后端产物
```bash
cd /workspace/projects/server

# 安装依赖
pnpm install

# 构建
pnpm build

# 构建产物位置
# /workspace/projects/server/dist/
```

### 2. 部署方式

#### 方式A: 使用PM2部署
```bash
cd /workspace/projects/server

# 安装PM2
npm install -g pm2

# 启动服务
pm2 start dist/main.js --name "ai-avatar-api"

# 保存配置
pm2 save
pm2 startup
```

#### 方式B: 使用Docker
```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

```bash
# 构建镜像
docker build -t ai-avatar-api .

# 运行容器
docker run -d -p 3000:3000 --env-file .env ai-avatar-api
```

---

## 三、数据库配置

### 1. 使用Supabase（推荐）
1. 访问 https://supabase.com 注册账号
2. 创建新项目
3. 获取连接信息：
   - Project URL
   - Project API Key (anon public)

### 2. 数据库表结构
需要创建以下表：

```sql
-- 用户表
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,
    nickname VARCHAR(50),
    avatar TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 分身表
CREATE TABLE avatars (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    name VARCHAR(100),
    description TEXT,
    persona TEXT,
    knowledge TEXT,
    image TEXT,
    status VARCHAR(20) DEFAULT 'active',
    is_public BOOLEAN DEFAULT false,
    price DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 订单表
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    avatar_id UUID REFERENCES avatars(id),
    amount DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    paid_at TIMESTAMP
);

-- 会话表
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    avatar_id UUID REFERENCES avatars(id),
    title VARCHAR(200),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    role VARCHAR(20),
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 帖子表
CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    content TEXT,
    images TEXT[],
    status VARCHAR(20) DEFAULT 'pending',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 收益表
CREATE TABLE earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),
    amount DECIMAL(10,2),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 交易记录表
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50),
    amount DECIMAL(10,2),
    status VARCHAR(20),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 四、环境变量配置

### 后端 .env 文件
```bash
# 服务端口号
PORT=3000

# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key

# JWT密钥
JWT_SECRET=your-secret-key-here

# 可选：其他API密钥
OPENAI_API_KEY=your-openai-key
```

### 前端环境变量
```bash
# 生产环境API地址
PROJECT_DOMAIN=https://your-api-domain.com
```

---

## 五、完整部署流程

### 1. 准备服务器
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y nodejs npm nginx

# 安装PM2
sudo npm install -g pm2

# 安装pnpm
sudo npm install -g pnpm
```

### 2. 上传代码
```bash
# 方式1: 使用scp
scp -r dist-web root@your-server:/var/www/ai-avatar/
scp -r server/dist root@your-server:/opt/ai-avatar-server/

# 方式2: 使用git
# 将代码推送到Git仓库，服务器上克隆
```

### 3. 配置Nginx
```bash
sudo nano /etc/nginx/sites-available/ai-avatar

# 添加配置（见上文）

sudo ln -s /etc/nginx/sites-available/ai-avatar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. 启动后端服务
```bash
cd /opt/ai-avatar-server

# 创建环境变量文件
echo "PORT=3000" > .env
echo "SUPABASE_URL=your-url" >> .env
echo "SUPABASE_KEY=your-key" >> .env

# 安装依赖
pnpm install --prod

# 使用PM2启动
pm2 start dist/main.js --name "ai-avatar-api"

# 查看日志
pm2 logs ai-avatar-api
```

---

## 六、目录结构说明

```
/workspace/projects/
├── src/                    # 前端源代码
│   ├── pages/             # 页面
│   ├── components/        # 组件
│   └── ...
├── server/                # 后端
│   ├── src/              # 后端源代码
│   └── dist/             # 构建产物
├── dist-web/             # 前端构建产物（部署用）
└── DEPLOY.md             # 本文件
```

---

## 七、关键文件清单

| 文件 | 说明 |
|------|------|
| `dist-web/index.html` | 前端入口 |
| `dist-web/js/*.js` | 前端JS |
| `server/dist/main.js` | 后端入口 |
| `server/.env` | 后端配置 |

---

## 八、小程序部署

### 1. 构建微信小程序
```bash
pnpm build:weapp
```

### 2. 使用微信开发者工具
- 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
- 导入项目：`/workspace/projects/dist-weapp`
- 配置AppID
- 上传代码

---

## 九、常见问题

### Q1: 数据库连接失败
检查 `.env` 文件中的 SUPABASE_URL 和 SUPABASE_KEY 是否正确。

### Q2: 前端无法调用API
检查前端请求地址是否正确配置，以及后端CORS设置。

### Q3: 登录失败
确认后端JWT_SECRET配置正确，且前后端Token验证逻辑一致。

---

## 十、默认账号

**管理后台：**
- 用户名: `admin`
- 密码: `admin123`

**注意：** 生产环境请立即修改默认密码！
