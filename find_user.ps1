$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== Find users with phone or wechat_id ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Last 5 users:"
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, phone, nickname, wechat_id FROM users ORDER BY created_at DESC LIMIT 5" 2>$null

Write-Host ""
Write-Host "Use the first user's ID for testing" -ForegroundColor Yellow