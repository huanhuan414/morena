-- 订单表
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR(36) PRIMARY KEY COMMENT '订单唯一ID',
  user_id VARCHAR(36) NOT NULL COMMENT '需求方用户ID',
  avatar_id VARCHAR(36) COMMENT '关联分身ID',
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
  priority VARCHAR(20) DEFAULT 'normal' COMMENT '优先级',
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
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单表';

-- 订单分发请求表
CREATE TABLE IF NOT EXISTS order_dispatch_requests (
  id VARCHAR(36) PRIMARY KEY COMMENT '分发请求ID',
  order_id VARCHAR(36) NOT NULL COMMENT '关联订单ID',
  avatar_id VARCHAR(36) NOT NULL COMMENT '分身份配ID',
  user_id VARCHAR(36) NOT NULL COMMENT '分身所属用户ID',
  platform VARCHAR(50) COMMENT '分配方式(auto/manual)',
  status VARCHAR(50) DEFAULT 'pending' COMMENT '请求状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单分发请求表';

-- 内容生成请求表
CREATE TABLE IF NOT EXISTS content_generation_requests (
  id VARCHAR(36) PRIMARY KEY COMMENT '生成请求ID',
  order_id VARCHAR(36) NOT NULL COMMENT '关联订单ID',
  avatar_id VARCHAR(36) NOT NULL COMMENT '创作分身ID',
  user_id VARCHAR(36) COMMENT '用户ID',
  platform VARCHAR(50) COMMENT '目标平台',
  status VARCHAR(50) DEFAULT 'queuing' COMMENT '生成状态',
  content TEXT COMMENT '生成的文案',
  images TEXT COMMENT '生成的图片URL列表(JSON)',
  video_url TEXT COMMENT '生成的视频URL列表(JSON)',
  publish_status TEXT COMMENT '发布状态详情(JSON)',
  publish_feedback TEXT COMMENT '发布反馈(JSON)',
  config TEXT COMMENT '生成配置(JSON)',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容生成请求表';

-- 订单结果表
CREATE TABLE IF NOT EXISTS order_results (
  id VARCHAR(36) PRIMARY KEY COMMENT '结果ID',
  order_id VARCHAR(36) NOT NULL COMMENT '关联订单ID',
  avatar_id VARCHAR(36) COMMENT '分身ID',
  user_id VARCHAR(36) COMMENT '用户ID',
  result TEXT COMMENT '结果数据(JSON)',
  customer_rating INT COMMENT '用户评分(1-5)',
  customer_comment TEXT COMMENT '用户评价',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_order_id (order_id),
  INDEX idx_avatar_id (avatar_id),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='订单结果表';

-- 收益记录表
CREATE TABLE IF NOT EXISTS earnings (
  id VARCHAR(36) PRIMARY KEY COMMENT '收益ID',
  user_id VARCHAR(36) NOT NULL COMMENT '收益归属用户',
  type VARCHAR(50) COMMENT '收益类型',
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
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='收益记录表';

-- 提现申请表
CREATE TABLE IF NOT EXISTS withdrawals (
  id VARCHAR(36) PRIMARY KEY COMMENT '提现ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  amount DECIMAL(10,2) DEFAULT 0 COMMENT '提现金额',
  method VARCHAR(50) COMMENT '提现方式',
  account VARCHAR(200) COMMENT '提现账号',
  status VARCHAR(50) DEFAULT 'pending' COMMENT '提现状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_user_id (user_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='提现申请表';

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
  id VARCHAR(36) PRIMARY KEY COMMENT '交易ID',
  user_id VARCHAR(36) NOT NULL COMMENT '用户ID',
  type VARCHAR(50) COMMENT '交易类型',
  amount DECIMAL(10,2) DEFAULT 0 COMMENT '交易金额',
  balance_before DECIMAL(10,2) DEFAULT 0 COMMENT '交易前余额',
  balance_after DECIMAL(10,2) DEFAULT 0 COMMENT '交易后余额',
  description VARCHAR(500) COMMENT '交易描述',
  source_id VARCHAR(36) COMMENT '来源ID',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  INDEX idx_user_id (user_id),
  INDEX idx_type (type),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='交易记录表';

-- 分身通知表
CREATE TABLE IF NOT EXISTS avatar_notifications (
  id VARCHAR(36) PRIMARY KEY COMMENT '通知ID',
  avatar_id VARCHAR(36) NOT NULL COMMENT '分身ID',
  order_id VARCHAR(36) COMMENT '关联订单ID',
  type VARCHAR(50) COMMENT '通知类型',
  title VARCHAR(200) COMMENT '通知标题',
  content TEXT COMMENT '通知内容',
  status VARCHAR(20) DEFAULT 'unread' COMMENT '通知状态',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  INDEX idx_avatar_id (avatar_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='分身通知表';