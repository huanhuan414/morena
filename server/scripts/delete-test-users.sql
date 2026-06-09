-- 删除测试账号数据脚本
-- 账号：18708510957

-- 1. 查询用户ID
SELECT id, phone, created_at FROM users WHERE phone IN ('18708510957');

-- 2. 查询邀请记录
SELECT * FROM referrals WHERE referrer_id IN (SELECT id FROM users WHERE phone IN ('18708510957')) OR referred_id IN (SELECT id FROM users WHERE phone IN ('18708510957'));

-- 3. 查询收益记录
SELECT * FROM earnings WHERE user_id IN (SELECT id FROM users WHERE phone IN ('18708510957'));

-- 4. 删除邀请记录
DELETE FROM referrals WHERE referrer_id IN (SELECT id FROM users WHERE phone IN ('18708510957')) OR referred_id IN (SELECT id FROM users WHERE phone IN ('18708510957'));

-- 5. 删除收益记录
DELETE FROM earnings WHERE user_id IN (SELECT id FROM users WHERE phone IN ('18708510957'));

-- 6. 删除用户数据
DELETE FROM users WHERE phone IN ('18708510957');

-- 7. 验证删除结果
SELECT COUNT(*) as remaining_users FROM users WHERE phone IN ('18708510957');
SELECT COUNT(*) as remaining_referrals FROM referrals WHERE referrer_id IN (SELECT id FROM users WHERE phone IN ('18708510957')) OR referred_id IN (SELECT id FROM users WHERE phone IN ('18708510957'));