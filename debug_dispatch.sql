-- 查询周航的分身详细状态
SELECT * FROM avatars WHERE user_id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034';

-- 查询周航的订阅状态
SELECT us.*, sp.name as plan_name, sp.concurrent_limit, sp.max_avatars 
FROM user_subscriptions us 
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id 
WHERE us.user_id = '8d72ec4e-e1e4-4037-87b0-4877ffa90034';

-- 查询周航分身最近的派单记录
SELECT odr.*, o.title as order_title, o.status as order_status
FROM order_dispatch_requests odr
LEFT JOIN orders o ON o.id = odr.order_id
WHERE odr.avatar_id = 'avatar_1779185280881_wtztd5oww'
ORDER BY odr.created_at DESC
LIMIT 10;

-- 查询发单者最近的订单
SELECT * FROM orders 
WHERE user_id = '0e238fc5-105a-4714-a2db-56fb8b00bead'
ORDER BY created_at DESC
LIMIT 10;
