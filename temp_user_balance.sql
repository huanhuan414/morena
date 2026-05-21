-- 查询用户余额和收益
SELECT 
  u.id,
  u.nickname,
  u.phone,
  u.balance,
  u.total_earnings,
  (SELECT SUM(amount) FROM earnings e WHERE e.user_id = u.id AND e.status IN ('settled', 'completed')) as calculated_earnings
FROM users u
WHERE u.id IN (
  'f248d436-ca49-4a3c-83eb-d372bf3f5d6e',
  '783aca74-1d70-41b5-94d2-bf127f1f1585'
);
