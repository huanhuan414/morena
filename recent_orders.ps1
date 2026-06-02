$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== Recent Orders (last 10) ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, content_type, status, is_paid, created_at FROM orders ORDER BY created_at DESC LIMIT 10" 2>$null