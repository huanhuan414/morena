$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== Check Order d6209941 ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, content_type, status, is_paid, created_at FROM orders WHERE id = 'd6209941-42e2-45c6-8c2c-b52ad48fff5b'" 2>$null

Write-Host ""
Write-Host "=== Check Order Assets ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, asset_type, status, asset_url, seedance_task_id FROM order_assets WHERE order_id = 'd6209941-42e2-45c6-8c2c-b52ad48fff5b'" 2>$null