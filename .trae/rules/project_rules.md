# Project Rules

## Server Configuration

### Remote Server
- **IP**: 180.184.205.74
- **SSH Port**: 22
- **Username**: root
- **Password**: ,OlvQF*U~P,=dS$G^*

### Database (MySQL on Remote Server)
- **Host**: 180.184.205.74 (or localhost when on server)
- **Port**: 16033
- **Database Name**: mrl
- **User**: mrl
- **Password**: SYDPHJB8aGBn83Eh

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
scp server/src/modules/auth/auth.service.ts root@180.184.205.74:/home/morena-ai/server/src/modules/auth/
scp server/src/modules/referral/referral.service.ts root@180.184.205.74:/home/morena-ai/server/src/modules/referral/

# Restart service
ssh root@180.184.205.74 "pm2 restart morena-api"
```

### Check Logs
```bash
ssh root@180.184.205.74 "pm2 logs morena-api --lines 50 --nostream"
```

### Database Queries
```bash
ssh root@180.184.205.74 "mysql -h 127.0.0.1 -P 16033 -u mrl -p'SYDPHJB8aGBn83Eh' mrl -e 'QUERY'"
```
