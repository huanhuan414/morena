$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== All tables in mrl ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SHOW TABLES" 2>$null

Write-Host ""
Write-Host "=== Order count ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT COUNT(*) as cnt FROM orders" 2>$null