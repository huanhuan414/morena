---
name: "morena-remote-admin"
description: "通过 SSH 在远程服务器执行 MySQL 查询/备份/恢复，并查看或重启 PM2 进程。Invoke when: 需要排查/修复线上数据或查看 morena-api 运行状态时。"
---

# Morena Remote Admin

用于在本地通过 SSH 操作远程服务器上的 MySQL（查询/更新/备份/恢复）以及 PM2（日志/重启）。

## 安全约束（必须遵守）

- 禁止把任何密码/密钥写进仓库文件（包括本 Skill 文档、脚本、配置）。
- 默认只读：仅在用户明确确认后才允许执行 `UPDATE/DELETE/ALTER/DROP`。
- 任何写操作前必须先做备份（至少表级 mysqldump），并把备份文件命名带时间戳。
- 执行 SQL 前先说明影响范围：目标表、WHERE 条件、预计影响行数（先 `SELECT COUNT(*)`）。

## 连接信息（非敏感项）

- SSH Host: `180.184.205.74`
- SSH Port: `22`
- DB Port: `16033`
- DB Name: `mrl`
- DB User: `mrl`

DB Password 属于敏感信息，请通过“运行时输入/本机私密配置”提供，不要写入仓库文件或命令行明文参数中。

## 推荐配置（避免在命令行暴露密码）

### 0) 本地私密配置文件（推荐）

前置条件：本机需要安装 MySQL Client（能运行 `mysql` 命令）。如未安装，可用 Homebrew：

```bash
brew install mysql-client
```

在本仓库内使用一个“只存在你本机、不会被 git 追踪”的私密配置文件保存 DB 密码，然后用 `--defaults-extra-file` 方式连接 MySQL，避免在命令行明文出现密码。

1) 在本地创建文件：

`/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/local/mysql.cnf`

内容参考同目录下的 `mysql.cnf.example`，把密码填进去。

2) 设置权限：

```bash
chmod 600 /Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/local/mysql.cnf
```

3) 本机直连远程 MySQL（不需要输入密码）：

```bash
mysql --defaults-extra-file=/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/local/mysql.cnf mrl -e "SELECT 1;"
mysql --defaults-extra-file=/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/local/mysql.cnf mrl -e "SHOW TABLES;"
```

若出现 `Access denied for user 'mrl'@'<你的公网IP>'`，通常是 MySQL 账号授权仅允许 `localhost`，此时建议改用 SSH 隧道（见下方“SSH 隧道连接”）。

4) 可选：使用本 Skill 自带的本地快捷脚本

先给脚本加可执行权限：

```bash
chmod +x /Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-mysql
chmod +x /Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-ssh
chmod +x /Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-ssh-auth
chmod +x /Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-db-tunnel
```

然后直接用：

```bash
/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-mysql -e "SELECT 1;"
/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-mysql -e "SHOW TABLES;"
/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-ssh "pm2 logs morena-api --lines 50 --nostream"
```

### SSH 隧道连接（推荐：可绕过 MySQL 外网授权限制）

前置条件：需要能 SSH 登录服务器。若你不想每次输入 SSH 密码，可在本机安装 `sshpass` 并放一个仅本机存在的密码文件。

```bash
brew install hudochenkov/sshpass/sshpass
```

密码文件路径（不会被 git 追踪）：

`/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/local/ssh.pass`

内容参考同目录下 `ssh.pass.example`，填入密码后：

```bash
chmod 600 /Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/local/ssh.pass
```

1) 启动隧道（保持此终端不退出）：

```bash
/Users/aiden/Projects/morena/.trae/skills/morena-remote-admin/bin/morena-db-tunnel 13306
```

2) 另开一个终端，连本地端口：

```bash
mysql -h 127.0.0.1 -P 13306 -u mrl -p mrl
```

### 1) SSH 别名（本机）

在 `~/.ssh/config` 增加（示例）：

```sshconfig
Host morena-prod
  HostName 180.184.205.74
  Port 22
  User root
```

你可以在所有命令里直接用 `ssh morena-prod ...`，避免每次重复输入 IP/端口/用户名。

重要：当前你的终端提示 `Permission denied (publickey,password)`，说明此服务器要么禁用了 root 密码登录，要么密码不正确；想要做到“以后不再输入 SSH 密码”，必须使用 SSH Key（或让运维侧开启密码登录，但不推荐）。

#### SSH Key 免密登录（推荐）

1) 本机生成 key（若已有可跳过）：

```bash
ssh-keygen -t ed25519
```

2) 把公钥加到服务器的 `~/.ssh/authorized_keys`：

- 若你能登录服务器：`ssh-copy-id morena-prod`
- 若你无法登录：需要通过云厂商控制台/现有可登录账号在服务器上手动追加公钥

3) 验证：

```bash
ssh morena-prod "echo SSH_OK"
```

### 2) 远端 MySQL 客户端 defaults 文件（远端服务器）

在远端服务器上（root 用户）创建 `~/.my.cnf`（权限必须 `600`），写入：

```ini
[client]
host=127.0.0.1
port=16033
user=mrl
password=YOUR_DB_PASSWORD
```

然后远端执行 `mysql mrl -e 'SELECT 1;'` 即可，无需每次带 `-p...`。

## 常用操作模板

### 连接远端 Shell

```bash
ssh morena-prod
```

### 远端执行只读 SQL（推荐：在远端 shell 里执行）

```bash
mysql mrl -e "SHOW TABLES;"
mysql mrl -e "SELECT COUNT(*) FROM referrals;"
```

### 通过 SSH 一次性执行 SQL（不推荐，容易暴露敏感信息）

更推荐先 `ssh morena-prod` 再执行 `mysql ...`。如果必须单命令执行：

```bash
ssh morena-prod "mysql mrl -e \"SELECT 1;\""
```

### 表级备份（远端生成文件）

```bash
mysqldump mrl referrals > /tmp/mrl_referrals_$(date +%F_%H%M%S).sql
ls -lh /tmp/mrl_referrals_*.sql | tail -n 5
```

### 备份流式导出到本机

```bash
ssh morena-prod "mysqldump mrl referrals" > ./mrl_referrals_$(date +%F_%H%M%S).sql
```

### 恢复（谨慎）

```bash
mysql mrl < ./backup.sql
```

恢复前先确认：

- 备份对应环境（生产/测试）
- 目标库名正确
- 备份文件来源可信且完整

## PM2 常用操作

### 查看最近日志

```bash
ssh morena-prod "pm2 logs morena-api --lines 200 --nostream"
```

### 重启服务

```bash
ssh morena-prod "pm2 restart morena-api"
```

## 执行流程（建议）

1. 明确目标：要查什么表、什么字段、时间范围/用户ID、期望结果。
2. 先只读验证：`SELECT ... LIMIT 20`、`COUNT(*)`、必要时 `EXPLAIN`。
3. 若需要写：先备份表 → 先 `SELECT COUNT(*) WHERE ...` 估算影响行数 → 执行写 SQL → 复查。
4. 如涉及接口行为：同步查看 `pm2 logs morena-api`，确认应用侧无异常。
