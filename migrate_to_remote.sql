-- ============================================
-- 线上数据库迁移脚本
-- 从本地数据库导出的缺失表和字段
-- ============================================

USE mrl;

-- ============================================
-- 1. 创建币交易记录表
-- ============================================
CREATE TABLE IF NOT EXISTS coin_transactions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(20) NOT NULL COMMENT 'recharge/consume/gift/refund',
  amount INT NOT NULL COMMENT '变动数量（正数为增加，负数为减少）',
  balance_before INT NOT NULL COMMENT '变动前余额',
  balance_after INT NOT NULL COMMENT '变动后余额',
  skill_type VARCHAR(50) COMMENT '技能类型（消费时）',
  description VARCHAR(200) COMMENT '描述',
  metadata JSON COMMENT '额外信息',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='币交易记录表';

-- ============================================
-- 2. 创建充值套餐表
-- ============================================
CREATE TABLE IF NOT EXISTS coin_recharge_packages (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(100) NOT NULL COMMENT '套餐名称',
  coins INT NOT NULL COMMENT '币数量',
  bonus INT DEFAULT 0 COMMENT '赠送币',
  price DECIMAL(10,2) NOT NULL COMMENT '价格（元）',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='充值套餐表';

-- 初始化充值套餐数据
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
  coins INT NOT NULL COMMENT '购买的币',
  bonus INT DEFAULT 0 COMMENT '赠送的币',
  amount DECIMAL(10,2) NOT NULL COMMENT '支付金额',
  payment_method VARCHAR(20) DEFAULT 'wechat' COMMENT '支付方式',
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/paid/failed',
  transaction_id VARCHAR(100) COMMENT '支付交易号',
  paid_at TIMESTAMP COMMENT '支付时间',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='充值记录表';

-- ============================================
-- 4. 创建内容类型价格配置表
-- ============================================
CREATE TABLE IF NOT EXISTS content_type_prices (
  id VARCHAR(36) PRIMARY KEY,
  content_type VARCHAR(50) NOT NULL UNIQUE COMMENT '内容类型ID',
  name VARCHAR(100) NOT NULL COMMENT '类型名称',
  icon VARCHAR(10) COMMENT '图标',
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '基础单价',
  content_price DECIMAL(10,2) NOT NULL DEFAULT 0 COMMENT '内容单价',
  description VARCHAR(500) COMMENT '描述',
  output_unit VARCHAR(50) COMMENT '输出单位',
  is_active BOOLEAN DEFAULT TRUE COMMENT '是否启用',
  sort_order INT DEFAULT 0 COMMENT '排序',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_content_type (content_type),
  INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='内容类型价格配置表';

-- 初始化价格配置数据
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
-- 5. subscription_plans表添加权益字段
-- ============================================
ALTER TABLE subscription_plans
ADD COLUMN IF NOT EXISTS concurrent_limit INT DEFAULT 1 COMMENT '同时接单数' AFTER order_priority,
ADD COLUMN IF NOT EXISTS auto_accept BOOLEAN DEFAULT FALSE COMMENT '自动接单' AFTER concurrent_limit,
ADD COLUMN IF NOT EXISTS text_daily_limit INT DEFAULT -1 COMMENT '文本每日限制' AFTER auto_accept,
ADD COLUMN IF NOT EXISTS image_daily_limit INT DEFAULT -1 COMMENT '图片每日限制' AFTER text_daily_limit,
ADD COLUMN IF NOT EXISTS video_daily_limit INT DEFAULT -1 COMMENT '视频每日限制' AFTER image_daily_limit,
ADD COLUMN IF NOT EXISTS article_daily_limit INT DEFAULT 0 COMMENT '文章每日限制' AFTER video_daily_limit,
ADD COLUMN IF NOT EXISTS clothing_daily_limit INT DEFAULT 0 COMMENT '服装每日限制' AFTER article_daily_limit,
ADD COLUMN IF NOT EXISTS palm_daily_limit INT DEFAULT 0 COMMENT '掌相每日限制' AFTER clothing_daily_limit;

-- 更新现有套餐数据
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
-- 6. content_generation_requests表添加驳回字段
-- ============================================
ALTER TABLE content_generation_requests
ADD COLUMN IF NOT EXISTS revision_count INT DEFAULT 0 COMMENT '驳回次数' AFTER publish_feedback,
ADD COLUMN IF NOT EXISTS revision_requested_at TIMESTAMP NULL COMMENT '驳回时间' AFTER revision_count;

-- ============================================
-- 7. users表添加币余额字段
-- ============================================
ALTER TABLE users
ADD COLUMN IF NOT EXISTS coins INT DEFAULT 0 COMMENT '币余额' AFTER current_balance;

-- ============================================
-- 8. orders表添加费用分离字段
-- ============================================
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS base_amount DECIMAL(10,2) DEFAULT 0 COMMENT '基础费用（分配给接单者）' AFTER budget,
ADD COLUMN IF NOT EXISTS content_amount DECIMAL(10,2) DEFAULT 0 COMMENT '内容费用（平台收取）' AFTER base_amount;

-- 更新现有订单数据
UPDATE orders
SET base_amount = budget,
    content_amount = 0
WHERE base_amount IS NULL OR base_amount = 0;

-- ============================================
-- 完成
-- ============================================
SELECT '数据库迁移完成！' AS status;
