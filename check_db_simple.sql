-- 简单检查脚本

-- 1. 检查关键表
SELECT 'TABLE_CHECK' AS check_type, 'coin_transactions' AS item, CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coin_transactions') > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'TABLE_CHECK', 'coin_recharge_packages', CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coin_recharge_packages') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'TABLE_CHECK', 'coin_recharge_records', CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'coin_recharge_records') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'TABLE_CHECK', 'content_type_prices', CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_type_prices') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'TABLE_CHECK', 'subscription_plans', CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'TABLE_CHECK', 'user_subscriptions', CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'user_subscriptions') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'TABLE_CHECK', 'payment_orders', CASE WHEN (SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payment_orders') > 0 THEN 'EXISTS' ELSE 'MISSING' END;

-- 2. 检查subscription_plans字段
SELECT 'FIELD_CHECK' AS check_type, 'subscription_plans.concurrent_limit' AS item, CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'concurrent_limit') > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'FIELD_CHECK', 'subscription_plans.auto_accept', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'auto_accept') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'FIELD_CHECK', 'subscription_plans.text_daily_limit', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'text_daily_limit') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'FIELD_CHECK', 'subscription_plans.image_daily_limit', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'image_daily_limit') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'FIELD_CHECK', 'subscription_plans.video_daily_limit', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'subscription_plans' AND COLUMN_NAME = 'video_daily_limit') > 0 THEN 'EXISTS' ELSE 'MISSING' END;

-- 3. 检查驳回相关字段
SELECT 'FIELD_CHECK' AS check_type, 'content_generation_requests.revision_count' AS item, CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_generation_requests' AND COLUMN_NAME = 'revision_count') > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'FIELD_CHECK', 'content_generation_requests.revision_requested_at', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'content_generation_requests' AND COLUMN_NAME = 'revision_requested_at') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'FIELD_CHECK', 'order_dispatch_requests.reject_reason', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'order_dispatch_requests' AND COLUMN_NAME = 'reject_reason') > 0 THEN 'EXISTS' ELSE 'MISSING' END;

-- 4. 检查币系统字段
SELECT 'FIELD_CHECK' AS check_type, 'users.coins' AS item, CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'coins') > 0 THEN 'EXISTS' ELSE 'MISSING' END AS status
UNION ALL
SELECT 'FIELD_CHECK', 'orders.base_amount', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'base_amount') > 0 THEN 'EXISTS' ELSE 'MISSING' END
UNION ALL
SELECT 'FIELD_CHECK', 'orders.content_amount', CASE WHEN (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' AND COLUMN_NAME = 'content_amount') > 0 THEN 'EXISTS' ELSE 'MISSING' END;
