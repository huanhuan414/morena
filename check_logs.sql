-- 查询周航的订阅状态
SELECT us.*, sp.name as plan_name, sp.concurrent_limit, sp.max_avatars
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034'
ORDER BY us.created_at DESC
LIMIT 5;
