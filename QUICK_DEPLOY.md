# 快速部署指南

## 📦 需要部署的文件

### 1. 前端文件（H5网站）
**位置：** `/workspace/projects/dist-web/`

必须文件：
- `index.html` - 入口文件
- `js/` - 所有JS文件（共约1.4MB）
- `css/` - 所有CSS文件
- `static/` - 静态资源

**部署方式：**
```bash
# 复制到Nginx目录
sudo cp -r /workspace/projects/dist-web/* /var/www/html/

# 或使用Node启动
npx serve -s /workspace/projects/dist-web -l 80
```

### 2. 后端文件（API服务）
**位置：** `/workspace/projects/server/dist/`

必须文件：
- `src/` - 所有编译后的JS文件
- `node_modules/` - 依赖（需要重新安装）

**部署方式：**
```bash
# 1. 上传后端代码到服务器
# 2. 安装依赖
npm install --production

# 3. 启动服务
node dist/src/main.js
```

### 3. 配置文件

**后端 `.env`：**
```bash
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
JWT_SECRET=your-secret-key
```

---

## 🚀 最简部署步骤

### 方案A：单服务器部署（推荐）

```bash
# 1. 准备服务器（Ubuntu）
sudo apt update
sudo apt install -y nodejs npm nginx

# 2. 上传前端文件
sudo mkdir -p /var/www/ai-avatar
sudo cp -r /workspace/projects/dist-web/* /var/www/ai-avatar/

# 3. 配置Nginx
sudo tee /etc/nginx/sites-available/ai-avatar << 'EOF'
server {
    listen 80;
    server_name your-domain.com;  # 替换你的域名或IP
    
    root /var/www/ai-avatar;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/ai-avatar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 4. 上传并启动后端
cd /opt
mkdir ai-avatar-server
cd ai-avatar-server

# 复制 server/dist/ 和 server/package.json 到此处
# 然后：
npm install --production

# 创建.env文件
cat > .env << EOF
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
JWT_SECRET=your-secret-key-min-32-characters-long
EOF

# 启动后端
npm install -g pm2
pm2 start dist/src/main.js --name "ai-avatar-api"
pm2 save
pm2 startup
```

---

## 🗄️ 数据库设置

### 使用Supabase（免费）
1. 注册：https://supabase.com
2. 创建项目
3. 复制Project URL和anon key
4. 在SQL编辑器中执行建表语句

**建表SQL文件位置：**
`/workspace/projects/DEPLOY.md` 中有完整的SQL

---

## 📋 部署检查清单

- [ ] 上传前端文件到 `/var/www/ai-avatar/`
- [ ] 上传后端文件到 `/opt/ai-avatar-server/`
- [ ] 配置Nginx反向代理
- [ ] 创建Supabase项目并执行SQL
- [ ] 填写 `.env` 配置
- [ ] 安装后端依赖
- [ ] 启动后端服务
- [ ] 访问 `http://your-server/pages/admin/login/index`
- [ ] 使用 admin/admin123 登录

---

## ❗ 重要提示

1. **生产环境必须修改默认密码！**
2. **JWT_SECRET至少32位随机字符串**
3. **防火墙开放80和3000端口**
4. **建议使用HTTPS**

---

## 🔍 测试命令

```bash
# 测试前端
curl http://localhost/

# 测试后端API
curl http://localhost:3000/api/admin/dashboard/stats -H "authorization:test"

# 查看服务状态
pm2 status
pm2 logs
```
