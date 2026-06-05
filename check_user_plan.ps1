$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

Write-Host "=== Check user subscription for 13043522122 ===" -ForegroundColor Cyan

$sql = @"
SELECT u.id, u.phone, us.plan_id, sp.name as plan_name, sp.auto_accept
FROM users u
LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.status = 'active'
LEFT JOIN subscription_plans sp ON us.plan_id = sp.id
WHERE u.phone = '13043522122'
"@

& $mysql -u root -p123456 mrl -e $sql 2>$null