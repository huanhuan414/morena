-- ============================================
-- 更新发单者所有老订单为已完成
-- 条件：status 为 pending_acceptance 或 awaiting_acceptance
-- ============================================
UPDATE orders 
SET status = 'completed', 
    updated_at = NOW()
WHERE status IN ('pending_acceptance', 'awaiting_acceptance', 'pending');

-- ============================================
-- 查看更新结果
-- ============================================
SELECT status, COUNT(*) as count FROM orders GROUP BY status;
