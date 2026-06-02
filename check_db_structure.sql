-- ============================================
-- 数据库结构检查脚本
-- 用于对比本地和线上数据库差异
-- ============================================

SELECT '========== 表检查 ==========' AS section;

-- 1. 检查关键表是否存在
SELECT 
  'TABLE' AS type,
  t.table_name AS item,
  CASE WHEN it.TABLE_NAME IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
  SELECT 'coin_transactions' AS table_name
  UNION SELECT 'coin_recharge_packages'
  UNION SELECT 'coin_recharge_records'
  UNION SELECT 'content_type_prices'
  UNION SELECT 'subscription_plans'
  UNION SELECT 'user_subscriptions'
  UNION SELECT 'payment_orders'
) t
LEFT JOIN information_schema.TABLES it 
  ON it.TABLE_SCHEMA = DATABASE() AND it.TABLE_NAME = t.table_name
ORDER BY t.table_name;

SELECT '========== subscription_plans字段检查 ==========' AS section;

-- 2. 检查subscription_plans表字段
SELECT 
  'FIELD' AS type,
  'subscription_plans' AS table_name,
  f.column_name AS item,
  CASE WHEN ic.COLUMN_NAME IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status,
  ic.COLUMN_TYPE AS column_type,
  ic.COLUMN_DEFAULT AS default_value
FROM (
  SELECT 'concurrent_limit' AS column_name
  UNION SELECT 'auto_accept'
  UNION SELECT 'text_daily_limit'
  UNION SELECT 'image_daily_limit'
  UNION SELECT 'video_daily_limit'
  UNION SELECT 'article_daily_limit'
  UNION SELECT 'clothing_daily_limit'
  UNION SELECT 'palm_daily_limit'
) f
LEFT JOIN information_schema.COLUMNS ic 
  ON ic.TABLE_SCHEMA = DATABASE() 
  AND ic.TABLE_NAME = 'subscription_plans' 
  AND ic.COLUMN_NAME = f.column_name
ORDER BY f.column_name;

SELECT '========== 驳回相关字段检查 ==========' AS section;

-- 3. 检查驳回相关字段
SELECT 
  'FIELD' AS type,
  f.table_name AS table_name,
  f.column_name AS item,
  CASE WHEN ic.COLUMN_NAME IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
  SELECT 'content_generation_requests' AS table_name, 'revision_count' AS column_name
  UNION SELECT 'content_generation_requests', 'revision_requested_at'
  UNION SELECT 'order_dispatch_requests', 'reject_reason'
) f
LEFT JOIN information_schema.COLUMNS ic 
  ON ic.TABLE_SCHEMA = DATABASE() 
  AND ic.TABLE_NAME = f.table_name 
  AND ic.COLUMN_NAME = f.column_name
ORDER BY f.table_name, f.column_name;

SELECT '========== 币系统字段检查 ==========' AS section;

-- 4. 检查币系统字段
SELECT 
  'FIELD' AS type,
  f.table_name AS table_name,
  f.column_name AS item,
  CASE WHEN ic.COLUMN_NAME IS NOT NULL THEN '✅ EXISTS' ELSE '❌ MISSING' END AS status
FROM (
  SELECT 'users' AS table_name, 'coins' AS column_name
  UNION SELECT 'orders', 'base_amount'
  UNION SELECT 'orders', 'content_amount'
) f
LEFT JOIN information_schema.COLUMNS ic 
  ON ic.TABLE_SCHEMA = DATABASE() 
  AND ic.TABLE_NAME = f.table_name 
  AND ic.COLUMN_NAME = f.column_name
ORDER BY f.table_name, f.column_name;

SELECT '========== 数据检查 ==========' AS section;

-- 5. 检查subscription_plans数据
SELECT 
  'DATA' AS type,
  'subscription_plans' AS table_name,
  COUNT(*) AS total_records,
  SUM(CASE WHEN concurrent_limit IS NOT NULL THEN 1 ELSE 0 END) AS has_concurrent_limit,
  SUM(CASE WHEN auto_accept IS NOT NULL THEN 1 ELSE 0 END) AS has_auto_accept,
  SUM(CASE WHEN text_daily_limit IS NOT NULL THEN 1 ELSE 0 END) AS has_text_limit
FROM subscription_plans;

-- 6. 检查充值套餐数据
SELECT 
  'DATA' AS type,
  'coin_recharge_packages' AS table_name,
  COUNT(*) AS record_count
FROM coin_recharge_packages;

-- 7. 检查价格配置数据
SELECT 
  'DATA' AS type,
  'content_type_prices' AS table_name,
  COUNT(*) AS record_count
FROM content_type_prices;

SELECT '========== 检查完成 ==========' AS section;
