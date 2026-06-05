-- ============================================
-- 备份订单表
-- ============================================
CREATE TABLE IF NOT EXISTS orders_backup_20260531 AS SELECT * FROM orders WHERE 1=0;

INSERT INTO orders_backup_20260531 SELECT * FROM orders WHERE status IN ('pending_acceptance', 'awaiting_acceptance', 'pending');

-- ============================================
-- 备份派单记录表
-- ============================================
CREATE TABLE IF NOT EXISTS order_dispatch_requests_backup_20260531 AS SELECT * FROM order_dispatch_requests WHERE 1=0;

INSERT INTO order_dispatch_requests_backup_20260531 SELECT * FROM order_dispatch_requests;

-- ============================================
-- 备份完成
-- ============================================
SELECT '备份完成，备份表: orders_backup_20260531, order_dispatch_requests_backup_20260531' AS status;
