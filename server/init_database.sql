-- ============================================
-- 「我的分身」MySQL 数据库初始化脚本
-- 执行方式: mysql -h <MYSQL_HOST> -P <MYSQL_PORT> -u <MYSQL_USER> -p<MYSQL_PASSWORD> <MYSQL_DATABASE> < init_database.sql
-- ============================================

-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS mrl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mrl;
ALTER DATABASE mrl CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ============================================
-- 1. 用户相关表
-- ============================================

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  openid VARCHAR(100) UNIQUE,
  nickname VARCHAR(100),
  avatar VARCHAR(500),
  avatar_url VARCHAR(500),
  bio TEXT,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  balance DECIMAL(10,2) DEFAULT 0,
  frozen_balance DECIMAL(10,2) DEFAULT 0,
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  credits INT DEFAULT 0,
  experience INT DEFAULT 0,
  referral_code VARCHAR(20),
  referral_count INT DEFAULT 0,
  referred_by VARCHAR(36),
  settings JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_openid (openid),
  INDEX idx_referral_code (referral_code),
  INDEX idx_referred_by (referred_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 验证码表
CREATE TABLE IF NOT EXISTS verification_codes (
  id VARCHAR(36) PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  type VARCHAR(20) DEFAULT 'login',
  expires_at TIMESTAMP NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone_code (phone, code),
  INDEX idx_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户订阅表
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  plan_id VARCHAR(36) NOT NULL,
  status VARCHAR(20) DEFAULT 'active',
  start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NOT NULL,
  max_avatars INT DEFAULT 1,
  can_receive_orders BOOLEAN DEFAULT FALSE,
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_end_date (end_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订阅计划表
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_days INT NOT NULL,
  max_avatars INT DEFAULT 1,
  can_receive_orders BOOLEAN DEFAULT FALSE,
  order_priority INT DEFAULT 0,
  features JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. 分身相关表
-- ============================================

-- AI分身表
CREATE TABLE IF NOT EXISTS avatars (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(100) NOT NULL,
  avatar_url VARCHAR(500),
  description TEXT,
  personality TEXT,
  voice_id VARCHAR(100),
  gender VARCHAR(20),
  age VARCHAR(20),
  interests JSON,
  skills JSON,
  config JSON,
  learning_data JSON,
  photo_analysis JSON,
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  total_interactions INT DEFAULT 0,
  total_posts INT DEFAULT 0,
  total_earnings DECIMAL(10,2) DEFAULT 0,
  color VARCHAR(20) DEFAULT '#7B3FE4',
  status VARCHAR(20) DEFAULT 'active',
  is_hosted BOOLEAN DEFAULT FALSE,
  is_online BOOLEAN DEFAULT FALSE,
  last_active_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_level (level),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身技能表
CREATE TABLE IF NOT EXISTS avatar_skills (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(64) NOT NULL,
  skill_id VARCHAR(36) NOT NULL,
  level INT DEFAULT 1,
  experience INT DEFAULT 0,
  unlocked BOOLEAN DEFAULT TRUE,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_skill_id (skill_id),
  UNIQUE KEY uk_avatar_skill (avatar_id, skill_id),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身记忆表
CREATE TABLE IF NOT EXISTS avatar_memories (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(64) NOT NULL,
  memory_type VARCHAR(50),
  content TEXT,
  importance INT DEFAULT 1,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_memory_type (memory_type),
  INDEX idx_importance (importance),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身好友表
CREATE TABLE IF NOT EXISTS avatar_friends (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(64) NOT NULL,
  friend_avatar_id VARCHAR(64) NOT NULL,
  affinity_level INT DEFAULT 0,
  last_interaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_friend_avatar_id (friend_avatar_id),
  UNIQUE KEY uk_friendship (avatar_id, friend_avatar_id),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身关注表
CREATE TABLE IF NOT EXISTS avatar_follows (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  target_avatar_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_target_avatar_id (target_avatar_id),
  UNIQUE KEY uk_follow (avatar_id, target_avatar_id),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身好感度表
CREATE TABLE IF NOT EXISTS avatar_affinity (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  affinity_level INT DEFAULT 0,
  total_interactions INT DEFAULT 0,
  last_interaction_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_user_id (user_id),
  UNIQUE KEY uk_affinity (avatar_id, user_id),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身账号配置表
CREATE TABLE IF NOT EXISTS avatar_accounts (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  platform VARCHAR(50) NOT NULL,
  platform_user_id VARCHAR(200),
  access_token TEXT,
  refresh_token TEXT,
  status VARCHAR(20) DEFAULT 'active',
  config JSON,
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_platform (platform),
  INDEX idx_status (status),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身通知表
CREATE TABLE IF NOT EXISTS avatar_notifications (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  notification_type VARCHAR(50),
  title VARCHAR(200),
  content TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身黑名单表
CREATE TABLE IF NOT EXISTS avatar_blocks (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  blocked_avatar_id VARCHAR(36) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_blocked_avatar_id (blocked_avatar_id),
  UNIQUE KEY uk_block (avatar_id, blocked_avatar_id),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身进化表
CREATE TABLE IF NOT EXISTS avatar_evolution (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  evolution_type VARCHAR(50),
  before_state JSON,
  after_state JSON,
  trigger_condition VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_evolution_type (evolution_type),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 3. 社交相关表
-- ============================================

-- 帖子表
CREATE TABLE IF NOT EXISTS posts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  avatar_id VARCHAR(36),
  content TEXT NOT NULL,
  images JSON,
  videos JSON,
  tags JSON,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  visibility VARCHAR(20) DEFAULT 'public',
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  INDEX idx_visibility (visibility),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 点赞表
CREATE TABLE IF NOT EXISTS likes (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  avatar_id VARCHAR(36),
  target_type VARCHAR(20) NOT NULL,
  target_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_target (target_type, target_id),
  UNIQUE KEY uk_like (user_id, avatar_id, target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 评论表
CREATE TABLE IF NOT EXISTS comments (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36),
  avatar_id VARCHAR(36),
  parent_id VARCHAR(36),
  content TEXT NOT NULL,
  likes_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_post_id (post_id),
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_parent_id (parent_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 关注表
CREATE TABLE IF NOT EXISTS follows (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  target_user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_target_user_id (target_user_id),
  UNIQUE KEY uk_follow (user_id, target_user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. 对话相关表
-- ============================================

-- 会话表
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  avatar_id VARCHAR(36) NOT NULL,
  title VARCHAR(200),
  context JSON,
  last_message TEXT,
  last_message_at TIMESTAMP,
  messages_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_last_message_at (last_message_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  sender_type VARCHAR(20) NOT NULL,
  sender_id VARCHAR(36),
  content TEXT NOT NULL,
  message_type VARCHAR(20) DEFAULT 'text',
  metadata JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_sender_id (sender_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 5. 订单相关表
-- ============================================

-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY COMMENT '订单唯一ID',
  user_id VARCHAR(36) NOT NULL COMMENT '需求方用户ID',
  avatar_id VARCHAR(64) COMMENT '关联分身ID',
  title VARCHAR(200) NOT NULL COMMENT '订单标题',
  description TEXT COMMENT '订单描述',
  content_type VARCHAR(50) DEFAULT 'text' COMMENT '内容类型',
  platforms TEXT COMMENT '目标平台列表(JSON)',
  requirements TEXT COMMENT '需求参数(JSON)',
  budget DECIMAL(10,2) DEFAULT 0 COMMENT '订单预算',
  status VARCHAR(50) DEFAULT 'pending_payment' COMMENT '订单状态',
  result TEXT COMMENT '订单结果(JSON)',
  expected_quantity INT DEFAULT 1 COMMENT '期望分身数量',
  quantity_per_avatar INT DEFAULT 1 COMMENT '每个分身产出数量',
  avatar_count INT DEFAULT 0 COMMENT '实际分配的分身数量',
  is_paid TINYINT DEFAULT 0 COMMENT '是否已支付',
  deadline DATETIME COMMENT '截止时间',
  priority INT DEFAULT 2 COMMENT '优先级(1-3)',
  primary_platform VARCHAR(50) COMMENT '主平台',
  preferred_styles TEXT COMMENT '偏好风格(JSON)',
  industry_tags TEXT COMMENT '行业标签(JSON)',
  deadline_at DATETIME COMMENT '抢单截止时间',
  content_deadline_at DATETIME COMMENT '内容截止时间',
  auto_cancel_at DATETIME COMMENT '自动取消时间',
  max_retries INT DEFAULT 3 COMMENT '最大重试次数',
  order_type VARCHAR(50) COMMENT '订单类型',
  assigned_to VARCHAR(36) COMMENT '分配给的用户',
  latitude DECIMAL(10,6) COMMENT '纬度',
  longitude DECIMAL(10,6) COMMENT '经度',
  location_text VARCHAR(500) COMMENT '位置文本',
  target_audience VARCHAR(200) COMMENT '目标受众',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  completed_at DATETIME COMMENT '完成时间',
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单表';

-- 订单执行记录表
CREATE TABLE IF NOT EXISTS order_executions (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  executor_id VARCHAR(36),
  execution_type VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  input_data JSON,
  output_data JSON,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_executor_id (executor_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单结果表
CREATE TABLE IF NOT EXISTS order_results (
  id VARCHAR(36) PRIMARY KEY COMMENT '结果ID',
  order_id VARCHAR(36) NOT NULL COMMENT '关联订单ID',
  avatar_id VARCHAR(64) COMMENT '分身ID',
  user_id VARCHAR(36) COMMENT '用户ID',
  result TEXT COMMENT '结果数据(JSON)',
  customer_rating INT COMMENT '用户评分(1-5)',
  customer_comment TEXT COMMENT '用户评价',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_avatar_id (avatar_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单结果表';

-- 订单分发请求表
CREATE TABLE IF NOT EXISTS order_dispatch_requests (
  id VARCHAR(36) PRIMARY KEY COMMENT '分发请求ID',
  order_id VARCHAR(36) NOT NULL COMMENT '关联订单ID',
  avatar_id VARCHAR(64) NOT NULL COMMENT '分身份配ID',
  user_id VARCHAR(36) NOT NULL COMMENT '分身所属用户ID',
  target_avatar_id VARCHAR(64) COMMENT '兼容字段：目标分身ID',
  target_user_id VARCHAR(36) COMMENT '兼容字段：目标用户ID',
  platform VARCHAR(50) COMMENT '分配方式(auto/manual)',
  status VARCHAR(50) DEFAULT 'pending' COMMENT '请求状态',
  reject_reason TEXT COMMENT '拒绝原因',
  expires_at DATETIME COMMENT '过期时间',
  responded_at DATETIME COMMENT '响应时间',
  accepted_at DATETIME COMMENT '接受时间',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单分发请求表';

-- 内容生成请求表
CREATE TABLE IF NOT EXISTS content_generation_requests (
  id VARCHAR(36) PRIMARY KEY COMMENT '生成请求ID',
  order_id VARCHAR(36) NOT NULL COMMENT '关联订单ID',
  avatar_id VARCHAR(64) NOT NULL COMMENT '创作分身ID',
  user_id VARCHAR(36) COMMENT '用户ID',
  platform VARCHAR(50) COMMENT '目标平台',
  status VARCHAR(50) DEFAULT 'queuing' COMMENT '生成状态',
  content_type VARCHAR(50) COMMENT '内容类型',
  content TEXT COMMENT '生成的文案',
  images TEXT COMMENT '生成的图片URL列表(JSON)',
  video_url TEXT COMMENT '生成的视频URL列表(JSON)',
  seedance_task_id VARCHAR(128) COMMENT '视频任务ID',
  publish_proof TEXT COMMENT '发布凭证(JSON)',
  error TEXT COMMENT '错误信息',
  publish_status TEXT COMMENT '发布状态详情(JSON)',
  publish_feedback TEXT COMMENT '发布反馈(JSON)',
  config TEXT COMMENT '生成配置(JSON)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容生成请求表';

-- 订单支付表
CREATE TABLE IF NOT EXISTS order_payments (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  payment_method VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 6. 收益相关表
-- ============================================

-- 收益表
CREATE TABLE IF NOT EXISTS earnings (
  id VARCHAR(36) PRIMARY KEY COMMENT '收益ID',
  user_id VARCHAR(36) NOT NULL COMMENT '收益归属用户',
  type VARCHAR(50) NOT NULL COMMENT '收益类型',
  amount DECIMAL(10,2) DEFAULT 0 COMMENT '收益金额',
  status VARCHAR(50) DEFAULT 'pending' COMMENT '收益状态',
  source VARCHAR(200) COMMENT '收益来源',
  description VARCHAR(500) COMMENT '收益描述',
  avatar_id VARCHAR(36) COMMENT '关联分身ID',
  order_id VARCHAR(36) COMMENT '关联订单ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_order_id (order_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收益记录表';

ALTER TABLE earnings
  ADD UNIQUE KEY uniq_earn_order_avatar_type (order_id, avatar_id, type);

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY COMMENT '交易ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  type VARCHAR(50) NOT NULL COMMENT '交易类型',
  amount DECIMAL(10,2) DEFAULT 0 COMMENT '交易金额',
  balance_before DECIMAL(10,2) DEFAULT 0 COMMENT '交易前余额',
  balance_after DECIMAL(10,2) DEFAULT 0 COMMENT '交易后余额',
  frozen_before DECIMAL(10,2) DEFAULT 0 COMMENT '交易前冻结余额',
  frozen_after DECIMAL(10,2) DEFAULT 0 COMMENT '交易后冻结余额',
  status VARCHAR(20) DEFAULT 'completed' COMMENT '交易状态',
  description VARCHAR(500) COMMENT '交易描述',
  reference_id VARCHAR(36) COMMENT '来源ID',
  idempotency_key VARCHAR(128) COMMENT '幂等键',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  UNIQUE KEY uk_transactions_idempotency (idempotency_key),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='交易记录表';

-- 提现表
CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR(36) PRIMARY KEY COMMENT '提现ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) DEFAULT 0 COMMENT '提现金额',
  method VARCHAR(50) COMMENT '提现方式',
  account VARCHAR(200) COMMENT '提现账号',
  status VARCHAR(50) DEFAULT 'pending' COMMENT '提现状态',
  rejected_reason TEXT COMMENT '驳回原因',
  processed_at DATETIME COMMENT '处理时间',
  error_message TEXT COMMENT '错误信息',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='提现申请表';

-- ============================================
-- 7. 技能相关表
-- ============================================

-- 技能表
CREATE TABLE IF NOT EXISTS skills (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  icon_url VARCHAR(500),
  prompt TEXT,
  config JSON,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 技能审核表
CREATE TABLE IF NOT EXISTS skill_reviews (
  id VARCHAR(36) PRIMARY KEY,
  skill_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  rating INT,
  content TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_skill_id (skill_id),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 8. 通知相关表
-- ============================================

-- 通知表
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  content TEXT,
  data JSON,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_is_read (is_read),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 9. 推荐相关表
-- ============================================

-- 推荐表
CREATE TABLE IF NOT EXISTS recommendations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(36),
  score DECIMAL(5,2),
  reason TEXT,
  is_clicked BOOLEAN DEFAULT FALSE,
  is_converted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_target (target_type, target_id),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 10. 引荐相关表
-- ============================================

-- 引荐表
CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(36) PRIMARY KEY,
  referrer_id VARCHAR(36) NOT NULL,
  referred_id VARCHAR(36) NOT NULL,
  reward_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_referrer_id (referrer_id),
  INDEX idx_referred_id (referred_id),
  INDEX idx_status (status),
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 11. 平台配置表
-- ============================================

-- 平台配置表
CREATE TABLE IF NOT EXISTS platform_configs (
  id VARCHAR(36) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  is_encrypted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_platform (platform),
  UNIQUE KEY uk_platform_key (platform, config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 12. 任务相关表
-- ============================================

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  avatar_id VARCHAR(36),
  task_type VARCHAR(50) NOT NULL,
  title VARCHAR(200),
  description TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  priority INT DEFAULT 0,
  scheduled_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  result JSON,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_task_type (task_type),
  INDEX idx_status (status),
  INDEX idx_scheduled_at (scheduled_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 13. 掌纹相关表
-- ============================================

-- 掌纹记录表
CREATE TABLE IF NOT EXISTS palm_reading_records (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  avatar_id VARCHAR(36),
  image_url VARCHAR(500) NOT NULL,
  result JSON,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 14. AI Agent 相关表
-- ============================================

-- 分身Agent配置表
CREATE TABLE IF NOT EXISTS avatar_agent_configs (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  config_type VARCHAR(50),
  config JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_is_active (is_active),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Agent任务日志表
CREATE TABLE IF NOT EXISTS agent_task_logs (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  task_type VARCHAR(50),
  input_data JSON,
  output_data JSON,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_task_type (task_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身学习记录表
CREATE TABLE IF NOT EXISTS avatar_learning_records (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  learning_type VARCHAR(50),
  content TEXT,
  result JSON,
  accuracy DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_learning_type (learning_type),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 15. 内容生成相关表
-- ============================================

-- 生成内容表
CREATE TABLE IF NOT EXISTS generated_content (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  avatar_id VARCHAR(36),
  content_type VARCHAR(50) NOT NULL,
  prompt TEXT,
  result JSON,
  status VARCHAR(20) DEFAULT 'pending',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_content_type (content_type),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 发布作品表
CREATE TABLE IF NOT EXISTS published_works (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  avatar_id VARCHAR(36),
  platform VARCHAR(50) NOT NULL,
  platform_post_id VARCHAR(200),
  content TEXT,
  media_urls JSON,
  likes_count INT DEFAULT 0,
  comments_count INT DEFAULT 0,
  shares_count INT DEFAULT 0,
  status VARCHAR(20) DEFAULT 'published',
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_platform (platform),
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 16. 支付相关表
-- ============================================

-- 支付订单表
CREATE TABLE IF NOT EXISTS payment_orders (
  id VARCHAR(36) PRIMARY KEY,
  out_trade_no VARCHAR(64) NOT NULL,
  plan_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  openid VARCHAR(64),
  order_type VARCHAR(50) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'CNY',
  payment_method VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_order_type (order_type),
  INDEX idx_status (status),
  INDEX idx_out_trade_no (out_trade_no),
  INDEX idx_transaction_id (transaction_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 17. 分身托管相关表
-- ============================================

-- 分身托管配置表
CREATE TABLE IF NOT EXISTS avatar_hosting_configs (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  hosting_type VARCHAR(50) DEFAULT 'auto',
  auto_reply_enabled BOOLEAN DEFAULT TRUE,
  auto_post_enabled BOOLEAN DEFAULT FALSE,
  auto_like_enabled BOOLEAN DEFAULT FALSE,
  auto_follow_enabled BOOLEAN DEFAULT FALSE,
  behavior_rules JSON,
  schedule_config JSON,
  status VARCHAR(20) DEFAULT 'active',
  last_run_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身托管日志表
CREATE TABLE IF NOT EXISTS avatar_hosting_logs (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(36),
  content TEXT,
  result VARCHAR(20) DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_action_type (action_type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 插入默认订阅计划
-- ============================================

INSERT IGNORE INTO subscription_plans (id, name, description, price, duration_days, max_avatars, can_receive_orders, order_priority, features) VALUES
('plan_free', '免费版', '基础功能体验', 0, 0, 1, FALSE, 0, '{"max_friends": 10, "avatar_storage_limit": "100MB"}'),
('plan_basic', '基础版', '日常使用推荐', 29.90, 30, 3, FALSE, 1, '{"max_friends": 50, "avatar_storage_limit": "1GB", "priority_support": false}'),
('plan_pro', '专业版', '专业用户首选', 99.90, 30, 10, TRUE, 2, '{"max_friends": 200, "avatar_storage_limit": "10GB", "priority_support": true, "advanced_analytics": true}'),
('plan_enterprise', '企业版', '企业用户定制', 299.90, 30, 999, TRUE, 3, '{"max_friends": -1, "avatar_storage_limit": "100GB", "priority_support": true, "advanced_analytics": true, "personal_manager": true}');

-- ============================================
-- 创建管理员账号（默认密码: admin123）
-- ============================================

INSERT IGNORE INTO users (id, phone, nickname, level, experience, settings) VALUES
('admin', '13800138000', '管理员', 99, 99999, '{"is_admin": true}');

-- ============================================
-- 完成
-- ============================================

SELECT '数据库初始化完成！' AS status;
