-- 添加 base_amount 和 content_amount 字段到 orders 表
-- 用于分离基础费用（给接单者）和内容费用（平台收取）

ALTER TABLE orders
ADD COLUMN base_amount DECIMAL(10,2) DEFAULT 0 COMMENT '基础费用（分配给接单者）' AFTER budget,
ADD COLUMN content_amount DECIMAL(10,2) DEFAULT 0 COMMENT '内容费用（平台收取）' AFTER base_amount;

-- 更新现有订单数据：将 budget 作为 base_amount，content_amount 设为 0
UPDATE orders
SET base_amount = budget,
    content_amount = 0
WHERE base_amount IS NULL OR base_amount = 0;
