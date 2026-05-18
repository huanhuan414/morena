-- 清空用户 13043522122 (a57b7f32-b713-464e-9a8b-6fec26eb4db8) 的所有数据

SET @user_id = 'a57b7f32-b713-464e-9a8b-6fec26eb4db8';

-- 1. 查看用户订单
SELECT '=== 用户订单 ===' AS info;
SELECT id, title, status FROM orders WHERE user_id = @user_id;

-- 2. 查看用户分身
SELECT '=== 用户分身 ===' AS info;
SELECT id, name FROM avatars WHERE user_id = @user_id;

-- 3. 删除订单相关的派单记录
DELETE FROM order_dispatch_requests WHERE order_id IN (SELECT id FROM orders WHERE user_id = @user_id);

-- 4. 删除订单相关的内容生成请求
DELETE FROM content_generation_requests WHERE order_id IN (SELECT id FROM orders WHERE user_id = @user_id);

-- 5. 删除订单相关的收益
DELETE FROM earnings WHERE order_id IN (SELECT id FROM orders WHERE user_id = @user_id);

-- 6. 删除订单
DELETE FROM orders WHERE user_id = @user_id;

-- 7. 删除分身相关的收益
DELETE FROM earnings WHERE avatar_id IN (SELECT id FROM avatars WHERE user_id = @user_id);

-- 8. 删除分身
DELETE FROM avatars WHERE user_id = @user_id;

SELECT '=== 清空完成 ===' AS info;
