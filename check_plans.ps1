$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

Write-Host "=== Subscription Plans ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, name, auto_accept, price, features FROM subscription_plans ORDER BY price ASC" 2>$null

Write-Host ""
Write-Host "=== User Subscriptions ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT us.id, us.user_id, us.plan_id, us.status, sp.name as plan_name, sp.auto_accept FROM user_subscriptions us LEFT JOIN subscription_plans sp ON us.plan_id = sp.id WHERE us.status = 'active' LIMIT 10" 2>$null