# Project Rules

## Server Configuration

### Remote Server
- **IP**: <REMOTE_IP>
- **SSH Port**: 22
- **Username**: <REMOTE_USER>
- **Password**: <REMOTE_SSH_PASSWORD>

### Database (MySQL on Remote Server)
- **Host**: <MYSQL_HOST> (or localhost when on server)
- **Port**: 16033
- **Database Name**: mrl
- **User**: <MYSQL_USER>
- **Password**: <MYSQL_PASSWORD>

### Database Tables
#### `referrals` table structure:
| Field | Type | Description |
|-------|------|-------------|
| id | varchar(36) | Primary Key |
| referrer_id | varchar(36) | 邀请人ID (注意: 不是 inviter_id) |
| referred_id | varchar(36) | 被邀请人ID (注意: 不是 invitee_id 或 referee_id) |
| reward_amount | decimal(10,2) | 奖励金额 |
| status | varchar(20) | 状态: pending/completed |
| created_at | timestamp | 创建时间 |

### Frontend Deployment
- **Remote Directory**: /home/morena-ai/dist-weapp

### Backend Deployment
- **Remote Directory**: /home/morena-ai/server
- **PM2 Process Name**: morena-api

## Deployment Commands

### Deploy Backend
```bash
# Upload modified files
scp server/src/modules/auth/auth.service.ts <REMOTE_USER>@<REMOTE_IP>:/home/morena-ai/server/src/modules/auth/
scp server/src/modules/referral/referral.service.ts <REMOTE_USER>@<REMOTE_IP>:/home/morena-ai/server/src/modules/referral/

# Restart service
ssh <REMOTE_USER>@<REMOTE_IP> "pm2 restart morena-api"
```

### Check Logs
```bash
ssh <REMOTE_USER>@<REMOTE_IP> "pm2 logs morena-api --lines 50 --nostream"
```

### Database Queries
```bash
ssh root@<REMOTE_IP> "mysql -h 127.0.0.1 -P <MYSQL_PORT> -u <MYSQL_USER> -p'<MYSQL_PASSWORD>' <MYSQL_DATABASE> -e 'QUERY'"
```
