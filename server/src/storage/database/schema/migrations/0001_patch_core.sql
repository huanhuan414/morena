SET @db := DATABASE();

SET @tbl := 'orders';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);

SET @col := 'primary_platform';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN primary_platform VARCHAR(50) NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'price';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN price DECIMAL(10,2) DEFAULT 0'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'content_deadline_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN content_deadline_at DATETIME NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'publish_proof_url';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN publish_proof_url LONGTEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'publish_verified';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN publish_verified TINYINT DEFAULT 0'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_orders_open_core';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (is_paid, status, priority, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_orders_open_platform';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (primary_platform, is_paid, status, priority, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_user_status_created_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (user_id, status, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'order_dispatch_requests';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);

SET @col := 'expires_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN expires_at DATETIME NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'responded_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN responded_at DATETIME NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'accepted_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN accepted_at DATETIME NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'reject_reason';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN reject_reason VARCHAR(500) NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'target_avatar_id';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN target_avatar_id VARCHAR(36) NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_expires_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (expires_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_odr_order_status_created';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (order_id, status, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'uniq_order_avatar';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD UNIQUE KEY ', @idx, ' (order_id, avatar_id)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'content_generation_requests';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);

SET @col := 'platforms';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN platforms LONGTEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'content_type';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN content_type VARCHAR(50) NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'content_quantity';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN content_quantity INT DEFAULT 1'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'seedance_task_id';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN seedance_task_id VARCHAR(128) NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'error';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN error TEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'publish_url';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN publish_url LONGTEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'publish_screenshot';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN publish_screenshot LONGTEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'verification_status';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN verification_status VARCHAR(20) DEFAULT ''pending'''),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'verified_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN verified_at TIMESTAMP NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_cgr_status_updated_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (status, updated_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_seedance_task_id';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (seedance_task_id)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'avatar_notifications';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);

SET @col := 'notification_type';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN notification_type VARCHAR(50) NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'is_read';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN is_read TINYINT DEFAULT 0'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'data';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN data LONGTEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_is_read';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (is_read)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'notifications';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);

SET @col := 'metadata';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN metadata TEXT NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col := 'updated_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = @db AND table_name = @tbl AND column_name = @col) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD COLUMN updated_at TIMESTAMP NULL'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'earnings';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);

SET @idx := 'uniq_earn_order_avatar_type';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD UNIQUE KEY ', @idx, ' (order_id, avatar_id, type)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

CREATE TABLE IF NOT EXISTS agent_tasks (
  task_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  avatar_id VARCHAR(36) NULL,
  task_description LONGTEXT NULL,
  conversation_id VARCHAR(64) NULL,
  conversation_history LONGTEXT NULL,
  attachments LONGTEXT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  result LONGTEXT NULL,
  error LONGTEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  expires_at DATETIME NULL,
  PRIMARY KEY (task_id),
  INDEX idx_agent_tasks_user (user_id),
  INDEX idx_agent_tasks_status (status),
  INDEX idx_agent_tasks_expires (expires_at),
  INDEX idx_agent_tasks_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS agent_task_progress (
  id BIGINT NOT NULL AUTO_INCREMENT,
  task_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  message LONGTEXT NOT NULL,
  data LONGTEXT NULL,
  timestamp_ms BIGINT NOT NULL,
  status VARCHAR(20) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_agent_task_progress_task (task_id),
  INDEX idx_agent_task_progress_user_task (user_id, task_id),
  INDEX idx_agent_task_progress_ts (timestamp_ms)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET @tbl := 'messages';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);
SET @idx := 'idx_conv_created_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (conversation_id, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'conversations';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);
SET @idx := 'idx_user_last_message_at';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (user_id, last_message_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'posts';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);
SET @idx := 'idx_vis_status_created';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (visibility, status, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'comments';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);
SET @idx := 'idx_post_status_created';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (post_id, status, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @tbl := 'referrals';
SET @tbl_exists := (
  SELECT COUNT(1)
  FROM information_schema.tables
  WHERE table_schema = @db AND table_name = @tbl
);
SET @idx := 'idx_referrals_referrer_created';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (referrer_id, created_at)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @idx := 'idx_referrals_referred_status';
SET @sql := (
  SELECT IF(
    @tbl_exists = 1 AND (SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = @db AND table_name = @tbl AND index_name = @idx) = 0,
    CONCAT('ALTER TABLE ', @tbl, ' ADD INDEX ', @idx, ' (referred_id, status)'),
    'SELECT 1'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
