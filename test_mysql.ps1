$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"

Write-Host "=== Test MySQL Connection ===" -ForegroundColor Cyan
$test = & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass -e "SELECT 1" 2>&1
Write-Host "Test result: $test"

Write-Host ""
Write-Host "=== Check MySQL Service ===" -ForegroundColor Cyan
Get-Service -Name "*mysql*" -ErrorAction SilentlyContinue | Select-Object Name, Status