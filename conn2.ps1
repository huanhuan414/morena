$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

Write-Host "=== Try no database ===" -ForegroundColor Cyan
$result = & $mysql -u root -p123456 -e "SHOW DATABASES" 2>&1
Write-Host "$result"