-- 清空用户 13043522122 的所有数据
SET @target_phone = '13043522122';

-- 1. 获取用户 ID
SELECT id INTO @user_id FROM users WHERE phone = @target_phone;

-- 2. 删除用户相关的所有数据
DELETE FROM withdrawals WHERE user_id = @user_id;
DELETE FROM earnings WHERE user_id = @user_id;
DELETE FROM referrals WHERE referrer_id = @user_id OR referred_id = @user_id;
DELETE FROM avatars WHERE user_id = @user_id;
DELETE FROM orders WHERE user_id = @user_id;

-- 3. 重置用户基础数据（只更新存在的字段）
UPDATE users 
SET 
    balance = 0, 
    frozen_balance = 0, 
    total_earnings = 0,
    experience = 0,
    exp = 0,
    credits = 0,
    created_at = NOW()
WHERE id = @user_id;

-- 4. 显示执行结果
SELECT '已清空用户数据' AS result, @user_id AS user_id, @target_phone AS phone;
