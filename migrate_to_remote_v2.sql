-- ============================================
-- 线上数据库迁移脚本 (MySQL 5.7兼容版)
-- ============================================

USE mrl;

-- ============================================
-- 1. 创建币交易记录表
-- ============================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL,
  amount INT NOT NULL,
  balance_before INT NOT NULL,
  balance_after INT NOT NULL,
  skill_type VARCHAR(50),
  description VARCHAR(200),
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 2. 创建充值套餐表
-- ============================================
CREATE TABLE IF NOT EXISTS coin_recharge_packages (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  coins INT NOT NULL,
  bonus INT DEFAULT 0,
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO coin_recharge_packages (id, name, coins, bonus, price, is_active, sort_order) VALUES
('pkg_100', '100币', 100, 0, 10.00, TRUE, 1),
('pkg_500', '500币', 500, 50, 50.00, TRUE, 2),
('pkg_1000', '1000币', 1000, 150, 100.00, TRUE, 3),
('pkg_2000', '2000币', 2000, 400, 200.00, TRUE, 4),
('pkg_5000', '5000币', 5000, 1500, 500.00, TRUE, 5);

-- ============================================
-- 3. 创建充值记录表
-- ============================================
CREATE TABLE IF NOT EXISTS coin_recharge_records (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  package_id VARCHAR(36) NOT NULL,
  coins INT NOT NULL,
  bonus INT DEFAULT 0,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(20) DEFAULT 'wechat',
  status VARCHAR(20) DEFAULT 'pending',
  transaction_id VARCHAR(100),
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================
-- 4. 创建内容类型价格配置表
-- ============================================
CREATE TABLE IF NOT EXISTS content_type_prices (
  id VARCHAR(36) PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  content_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  description VARCHAR(500),
  output_unit VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_content_type (content_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO content_type_prices (id, content_type, name, icon, base_price, content_price, description, output_unit, sort_order) VALUES
('ctp_simple', 'simple', '简单任务', '✅', 0.50, 0.00, '关注/点赞/转发等', '个任务', 1),
('ctp_text', 'text', '纯文案', '📝', 2.00, 0.00, '文字内容创作', '篇原创文案', 2),
('ctp_image', 'image', '图文笔记', '🖼️', 3.00, 1.00, '图文搭配呈现', '篇图文笔记', 3),
('ctp_video', 'video', '短视频', '🎬', 5.00, 20.00, 'AI生成真实视频', '条短视频', 4)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  icon = VALUES(icon),
  base_price = VALUES(base_price),
  content_price = VALUES(content_price),
  description = VALUES(description),
  output_unit = VALUES(output_unit),
  sort_order = VALUES(sort_order);

-- ============================================
-- 5. 添加字段 (使用存储过程)
-- ============================================

DROP PROCEDURE IF EXISTS add_column_if_not_exists;

DELIMITER //

CREATE PROCEDURE add_column_if_not_exists(
  IN table_name_param VARCHAR(100),
  IN column_name_param VARCHAR(100),
  IN column_definition VARCHAR(500)
)
BEGIN
  DECLARE column_exists INT DEFAULT 0;
  
  SELECT COUNT(*) INTO column_exists
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = table_name_param
    AND COLUMN_NAME = column_name_param;
  
  IF column_exists = 0 THEN
    SET @sql = CONCAT('ALTER TABLE ', table_name_param, ' ADD COLUMN ', column_name_param, ' ', column_definition);
    PREPARE stmt FROM @sql;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

-- 添加subscription_plans表字段
CALL add_column_if_not_exists('subscription_plans', 'concurrent_limit', 'INT DEFAULT 1');
CALL add_column_if_not_exists('subscription_plans', 'auto_accept', 'BOOLEAN DEFAULT FALSE');
CALL add_column_if_not_exists('subscription_plans', 'text_daily_limit', 'INT DEFAULT -1');
CALL add_column_if_not_exists('subscription_plans', 'image_daily_limit', 'INT DEFAULT -1');
CALL add_column_if_not_exists('subscription_plans', 'video_daily_limit', 'INT DEFAULT -1');
CALL add_column_if_not_exists('subscription_plans', 'article_daily_limit', 'INT DEFAULT 0');
CALL add_column_if_not_exists('subscription_plans', 'clothing_daily_limit', 'INT DEFAULT 0');
CALL add_column_if_not_exists('subscription_plans', 'palm_daily_limit', 'INT DEFAULT 0');

-- 添加content_generation_requests表字段
CALL add_column_if_not_exists('content_generation_requests', 'revision_count', 'INT DEFAULT 0');
CALL add_column_if_not_exists('content_generation_requests', 'revision_requested_at', 'TIMESTAMP NULL');

-- 添加users表字段
CALL add_column_if_not_exists('users', 'coins', 'INT DEFAULT 0');

-- 添加orders表字段
CALL add_column_if_not_exists('orders', 'base_amount', 'DECIMAL(10,2) DEFAULT 0');
CALL add_column_if_not_exists('orders', 'content_amount', 'DECIMAL(10,2) DEFAULT 0');

-- 删除存储过程
DROP PROCEDURE IF EXISTS add_column_if_not_exists;

-- ============================================
-- 6. 更新套餐数据
-- ============================================
UPDATE subscription_plans SET 
  concurrent_limit = CASE id
    WHEN 'plan_free' THEN 1
    WHEN 'plan_basic' THEN 3
    WHEN 'plan_pro' THEN 10
    WHEN 'plan_enterprise' THEN 999
    ELSE 1
  END,
  auto_accept = CASE id
    WHEN 'plan_pro' THEN TRUE
    WHEN 'plan_enterprise' THEN TRUE
    ELSE FALSE
  END,
  text_daily_limit = CASE id
    WHEN 'plan_free' THEN 5
    WHEN 'plan_basic' THEN 20
    WHEN 'plan_pro' THEN 100
    WHEN 'plan_enterprise' THEN -1
    ELSE -1
  END,
  image_daily_limit = CASE id
    WHEN 'plan_free' THEN 3
    WHEN 'plan_basic' THEN 10
    WHEN 'plan_pro' THEN 50
    WHEN 'plan_enterprise' THEN -1
    ELSE -1
  END,
  video_daily_limit = CASE id
    WHEN 'plan_free' THEN 1
    WHEN 'plan_basic' THEN 5
    WHEN 'plan_pro' THEN 20
    WHEN 'plan_enterprise' THEN -1
    ELSE -1
  END
WHERE id IN ('plan_free', 'plan_basic', 'plan_pro', 'plan_enterprise');

-- ============================================
-- 7. 更新订单数据
-- ============================================
UPDATE orders
SET base_amount = budget,
    content_amount = 0
WHERE base_amount IS NULL OR base_amount = 0;

-- ============================================
-- 完成
-- ============================================
SELECT 'Migration completed successfully!' AS status;
