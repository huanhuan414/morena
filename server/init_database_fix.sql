-- ============================================
-- MySQL 数据库补充脚本（MySQL 5.x 兼容版本）
-- ============================================

USE mrl;

-- ============================================
-- 1. 补充 users 表缺失字段
-- ============================================

-- 添加 referred_by 列（如果不存在）
SET @column_exists = 0;
SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'users' AND column_name = 'referred_by';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE users ADD COLUMN referred_by VARCHAR(36) AFTER referral_code', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 frozen_balance 列
SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'users' AND column_name = 'frozen_balance';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE users ADD COLUMN frozen_balance DECIMAL(10,2) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 添加 experience 列
SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'users' AND column_name = 'experience';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE users ADD COLUMN experience INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 2. 补充 avatars 表缺失字段
-- ============================================

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'voice_id';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN voice_id VARCHAR(100)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'gender';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN gender VARCHAR(20)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'age';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN age VARCHAR(20)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'interests';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN interests JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'color';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN color VARCHAR(20) DEFAULT \"#7B3FE4\"', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'is_hosted';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN is_hosted TINYINT(1) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'is_online';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN is_online TINYINT(1) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'last_active_at';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN last_active_at TIMESTAMP NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'total_interactions';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN total_interactions INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'total_posts';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN total_posts INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'total_earnings';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE avatars ADD COLUMN total_earnings DECIMAL(10,2) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @avatar_has_trust_enabled FROM information_schema.columns
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'trust_enabled';
SELECT COUNT(*) INTO @avatar_has_is_hosted FROM information_schema.columns
WHERE table_schema = 'mrl' AND table_name = 'avatars' AND column_name = 'is_hosted';
SET @avatar_sync_sql = IF(
  @avatar_has_trust_enabled > 0 AND @avatar_has_is_hosted > 0,
  'UPDATE avatars SET is_hosted = CASE WHEN trust_enabled IN (1, ''1'', true, ''true'') THEN 1 ELSE 0 END',
  'SELECT 1'
);
PREPARE stmt FROM @avatar_sync_sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 3. 补充 posts 表缺失字段
-- ============================================

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'posts' AND column_name = 'visibility';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE posts ADD COLUMN visibility VARCHAR(20) DEFAULT \"public\"', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'posts' AND column_name = 'status';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE posts ADD COLUMN status VARCHAR(20) DEFAULT \"active\"', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ============================================
-- 4. 补充 orders 表缺失字段
-- ============================================

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'orders' AND column_name = 'order_type';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE orders ADD COLUMN order_type VARCHAR(50) DEFAULT \"content_creation\"', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'orders' AND column_name = 'requirements';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE orders ADD COLUMN requirements JSON', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'orders' AND column_name = 'priority';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE orders ADD COLUMN priority INT DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'orders' AND column_name = 'assigned_to';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE orders ADD COLUMN assigned_to VARCHAR(36)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SELECT COUNT(*) INTO @column_exists FROM information_schema.columns 
WHERE table_schema = 'mrl' AND table_name = 'orders' AND column_name = 'price';
SET @sql = IF(@column_exists = 0, 'ALTER TABLE orders ADD COLUMN price DECIMAL(10,2) DEFAULT 0', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

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
  verified TINYINT(1) DEFAULT 0,
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
  auto_renew TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订阅计划表
CREATE TABLE IF NOT EXISTS subscription_plans (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  duration_days INT NOT NULL,
  max_avatars INT DEFAULT 1,
  can_receive_orders TINYINT(1) DEFAULT 0,
  order_priority INT DEFAULT 0,
  features JSON,
  is_active TINYINT(1) DEFAULT 1,
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
  unlocked TINYINT(1) DEFAULT 1,
  config JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_skill_id (skill_id),
  UNIQUE KEY uk_avatar_skill (avatar_id, skill_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身记忆表
CREATE TABLE IF NOT EXISTS avatar_memories (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  memory_type VARCHAR(50),
  content TEXT,
  importance INT DEFAULT 1,
  last_accessed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_memory_type (memory_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身好友表
CREATE TABLE IF NOT EXISTS avatar_friends (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  friend_avatar_id VARCHAR(36) NOT NULL,
  affinity_level INT DEFAULT 0,
  last_interaction_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_friend_avatar_id (friend_avatar_id),
  UNIQUE KEY uk_friendship (avatar_id, friend_avatar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身关注表
CREATE TABLE IF NOT EXISTS avatar_follows (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  target_avatar_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_target_avatar_id (target_avatar_id),
  UNIQUE KEY uk_follow (avatar_id, target_avatar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身好感度表
CREATE TABLE IF NOT EXISTS avatar_affinity (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  affinity_level INT DEFAULT 0,
  total_interactions INT DEFAULT 0,
  last_interaction_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_user_id (user_id),
  UNIQUE KEY uk_affinity (avatar_id, user_id)
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
  last_sync_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_platform (platform)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身通知表
CREATE TABLE IF NOT EXISTS avatar_notifications (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  notification_type VARCHAR(50),
  title VARCHAR(200),
  content TEXT,
  is_read TINYINT(1) DEFAULT 0,
  data JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_is_read (is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身黑名单表
CREATE TABLE IF NOT EXISTS avatar_blocks (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  blocked_avatar_id VARCHAR(36) NOT NULL,
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id),
  UNIQUE KEY uk_block (avatar_id, blocked_avatar_id)
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
  INDEX idx_avatar_id (avatar_id)
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
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id)
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
  accepted_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单支付表
CREATE TABLE IF NOT EXISTS order_payments (
  id VARCHAR(36) PRIMARY KEY,
  order_id VARCHAR(36) NOT NULL,
  payment_method VARCHAR(50),
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_order_id (order_id)
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
  is_active TINYINT(1) DEFAULT 1,
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
  INDEX idx_user_id (user_id)
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
  is_clicked TINYINT(1) DEFAULT 0,
  is_converted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 引荐表
CREATE TABLE IF NOT EXISTS referrals (
  id VARCHAR(36) PRIMARY KEY,
  referrer_id VARCHAR(36) NOT NULL,
  referred_id VARCHAR(36) NOT NULL,
  reward_amount DECIMAL(10,2) DEFAULT 0,
  status VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_referrer_id (referrer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 平台配置表
CREATE TABLE IF NOT EXISTS platform_configs (
  id VARCHAR(36) PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  config_key VARCHAR(100) NOT NULL,
  config_value TEXT,
  is_encrypted TINYINT(1) DEFAULT 0,
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
  scheduled_at TIMESTAMP NULL,
  started_at TIMESTAMP NULL,
  completed_at TIMESTAMP NULL,
  result JSON,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status)
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
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身Agent配置表
CREATE TABLE IF NOT EXISTS avatar_agent_configs (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  config_type VARCHAR(50),
  config JSON,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id)
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
  INDEX idx_task_type (task_type)
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
  INDEX idx_learning_type (learning_type)
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
  INDEX idx_content_type (content_type)
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
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_platform (platform)
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
  paid_at TIMESTAMP NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 分身托管配置表
CREATE TABLE IF NOT EXISTS avatar_hosting_configs (
  id VARCHAR(36) PRIMARY KEY,
  avatar_id VARCHAR(36) NOT NULL,
  hosting_type VARCHAR(50) DEFAULT 'auto',
  auto_reply_enabled TINYINT(1) DEFAULT 1,
  auto_post_enabled TINYINT(1) DEFAULT 0,
  auto_like_enabled TINYINT(1) DEFAULT 0,
  auto_follow_enabled TINYINT(1) DEFAULT 0,
  behavior_rules JSON,
  schedule_config JSON,
  status VARCHAR(20) DEFAULT 'active',
  last_run_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_avatar_id (avatar_id)
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
  INDEX idx_avatar_id (avatar_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 插入默认订阅计划
-- ============================================

INSERT IGNORE INTO subscription_plans (id, name, description, price, duration_days, max_avatars, can_receive_orders, order_priority, features) VALUES
('plan_free', '免费版', '基础功能体验', 0, 0, 1, 0, 0, '{"max_friends": 10, "avatar_storage_limit": "100MB"}'),
('plan_basic', '基础版', '日常使用推荐', 29.90, 30, 3, 0, 1, '{"max_friends": 50, "avatar_storage_limit": "1GB"}'),
('plan_pro', '专业版', '专业用户首选', 99.90, 30, 10, 1, 2, '{"max_friends": 200, "avatar_storage_limit": "10GB"}'),
('plan_enterprise', '企业版', '企业用户定制', 299.90, 30, 999, 1, 3, '{"max_friends": -1, "avatar_storage_limit": "100GB"}');

-- ============================================
-- 创建管理员账号
-- ============================================

INSERT IGNORE INTO users (id, phone, nickname, level, exp, settings) VALUES
('admin', '13800138000', '管理员', 99, 99999, '{"is_admin": true}');

-- ============================================
-- 完成
-- ============================================

SELECT '数据库补充完成！' AS status;
SHOW TABLES;
