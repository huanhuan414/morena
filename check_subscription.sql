-- 查询周航的订阅信息
SELECT us.*, sp.name as plan_name, sp.concurrent_limit, sp.max_avatars
FROM user_subscriptions us
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE us.user_id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034'
ORDER BY us.created_at DESC
LIMIT 5;

-- 查询周航的分身数量
SELECT COUNT(*) as avatar_count, 
       SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_count
FROM avatars 
WHERE user_id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034';
