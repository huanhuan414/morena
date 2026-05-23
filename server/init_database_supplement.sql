-- ============================================
-- MySQL 数据库补充脚本（添加缺失的表）
-- 基于现有表结构适配
-- ============================================

USE mrl;

-- ============================================
-- 1. 补充 users 表缺失字段
-- ============================================
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS referred_by VARCHAR(36) AFTER referral_code,
ADD COLUMN IF NOT EXISTS frozen_balance DECIMAL(10,2) DEFAULT 0 AFTER current_balance,
ADD COLUMN IF NOT EXISTS experience INT DEFAULT 0 AFTER level,
MODIFY COLUMN exp INT DEFAULT 0;

-- ============================================
-- 2. 补充 avatars 表缺失字段
-- ============================================
ALTER TABLE avatars
ADD COLUMN IF NOT EXISTS voice_id VARCHAR(100) AFTER personality,
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) AFTER voice_id,
ADD COLUMN IF NOT EXISTS age VARCHAR(20) AFTER gender,
ADD COLUMN IF NOT EXISTS interests JSON AFTER age,
ADD COLUMN IF NOT EXISTS color VARCHAR(20) DEFAULT '#7B3FE4' AFTER total_earnings,
ADD COLUMN IF NOT EXISTS is_hosted BOOLEAN DEFAULT FALSE AFTER status,
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE AFTER is_hosted,
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP NULL AFTER is_online,
ADD COLUMN IF NOT EXISTS total_interactions INT DEFAULT 0 AFTER experience,
ADD COLUMN IF NOT EXISTS total_posts INT DEFAULT 0 AFTER total_interactions,
ADD COLUMN IF NOT EXISTS total_earnings DECIMAL(10,2) DEFAULT 0 AFTER total_posts;

-- 如果存在旧字段 trust_enabled，则回填到统一字段 is_hosted
SET @avatar_has_trust_enabled = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'avatars'
    AND column_name = 'trust_enabled'
);
SET @avatar_has_is_hosted = (
  SELECT COUNT(*)
  FROM information_schema.columns
  WHERE table_schema = DATABASE()
    AND table_name = 'avatars'
    AND column_name = 'is_hosted'
);
SET @sync_avatar_hosting_sql = IF(
  @avatar_has_trust_enabled > 0 AND @avatar_has_is_hosted > 0,
  'UPDATE avatars SET is_hosted = CASE WHEN trust_enabled IN (1, ''1'', true, ''true'') THEN 1 ELSE 0 END',
  'SELECT 1'
);
PREPARE stmt_avatar_hosting_sync FROM @sync_avatar_hosting_sql;
EXECUTE stmt_avatar_hosting_sync;
DEALLOCATE PREPARE stmt_avatar_hosting_sync;

-- ============================================
-- 3. 补充 posts 表缺失字段
-- ============================================
ALTER TABLE posts
ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) DEFAULT 'public' AFTER shares_count,
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active' AFTER visibility,
MODIFY COLUMN is_public TINYINT(1) DEFAULT 1;

-- ============================================
-- 4. 补充 orders 表缺失字段
-- ============================================
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50) DEFAULT 'content_creation' AFTER avatar_id,
ADD COLUMN IF NOT EXISTS requirements JSON AFTER order_type,
ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0 AFTER status,
ADD COLUMN IF NOT EXISTS assigned_to VARCHAR(36) AFTER priority,
ADD COLUMN IF NOT EXISTS price DECIMAL(10,2) DEFAULT 0 AFTER assigned_to;

-- ============================================
-- 5. 创建缺失的表
-- ============================================

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
  auto_renew BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
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

-- 分身技能表
CREATE TABLE IF NOT EXISTS avatar_skills (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
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
  avatar_id VARCHAR(36) NOT NULL,
  memory_type VARCHAR(50),
  content TEXT,
  importance INT DEFAULT 1,
  last_accessed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_memory_type (memory_type),
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身好友表
CREATE TABLE IF NOT EXISTS avatar_friends (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  friend_avatar_id VARCHAR(36) NOT NULL,
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
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单派发表
CREATE TABLE IF NOT EXISTS order_dispatch_requests (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  target_avatar_id VARCHAR(36),
  target_user_id VARCHAR(36),
  status VARCHAR(20) DEFAULT 'pending',
  priority INT DEFAULT 0,
  estimated_time INT,
  accepted_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  INDEX idx_is_active (is_active)
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
  FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 引荐表
CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(36) PRIMARY KEY,
  referrer_id VARCHAR(36) NOT NULL,
  referred_id VARCHAR(36) NOT NULL,
  reward_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_referrer_id (referrer_id),
  FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 支付订单表
CREATE TABLE IF NOT EXISTS payment_orders (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
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
  INDEX idx_status (status),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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
  FOREIGN KEY (avatar_id) REFERENCES avatars(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 插入默认订阅计划
-- ============================================

INSERT IGNORE INTO subscription_plans (id, name, description, price, duration_days, max_avatars, can_receive_orders, order_priority, features) VALUES
('plan_free', '免费版', '基础功能体验', 0, 0, 1, FALSE, 0, '{"max_friends": 10, "avatar_storage_limit": "100MB"}'),
('plan_basic', '基础版', '日常使用推荐', 29.90, 30, 3, FALSE, 1, '{"max_friends": 50, "avatar_storage_limit": "1GB"}'),
('plan_pro', '专业版', '专业用户首选', 99.90, 30, 10, TRUE, 2, '{"max_friends": 200, "avatar_storage_limit": "10GB"}'),
('plan_enterprise', '企业版', '企业用户定制', 299.90, 30, 999, TRUE, 3, '{"max_friends": -1, "avatar_storage_limit": "100GB"}');

-- ============================================
-- 创建管理员账号
-- ============================================

INSERT IGNORE INTO users (id, phone, nickname, level, exp, settings) VALUES
('admin', '13800138000', '管理员', 99, 99999, '{"is_admin": true}');

-- ============================================
-- 完成
-- ============================================

SELECT '数据库补充完成！' AS status;
