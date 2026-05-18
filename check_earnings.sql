-- 检查是否有订单收益
SELECT * FROM earnings WHERE type = 'order_reward' LIMIT 5;

-- 检查推荐奖励的完整记录
SELECT * FROM earnings WHERE type = 'referral_bonus' LIMIT 1;

-- 检查订单 a6d943e0-15db-4d67-8162-f896d6b04bf4 的收益
SELECT * FROM earnings WHERE order_id = 'a6d943e0-15db-4d67-8162-f896d6b04bf4';
