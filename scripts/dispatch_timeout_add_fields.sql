-- 订单派单超时功能
-- 为 order_dispatch_requests 表添加派单时间字段

-- 新增字段说明：
-- dispatched_at: 派单时间，用于记录派单时刻
-- expired_at: 超时过期时间，派单后10分钟自动过期

ALTER TABLE order_dispatch_requests 
ADD COLUMN IF NOT EXISTS dispatched_at DATETIME DEFAULT NULL COMMENT '派单时间',
ADD COLUMN IF NOT EXISTS expired_at DATETIME DEFAULT NULL COMMENT '超时过期时间（派单后10分钟自动过期）';

-- 创建索引用于查询超时的派单记录
CREATE INDEX IF NOT EXISTS idx_dispatch_expired 
ON order_dispatch_requests (status, expired_at) 
WHERE expired_at IS NOT NULL;