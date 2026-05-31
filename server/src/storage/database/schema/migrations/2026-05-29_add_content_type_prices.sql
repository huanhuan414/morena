-- 内容类型价格配置表
-- 用于存储不同内容类型的基础价格和内容价格

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

-- 初始化数据
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
