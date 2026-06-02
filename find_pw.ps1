$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbName = "mrl"

# Try empty password first
Write-Host "=== Try empty password ===" -ForegroundColor Cyan
$test = & $mysql -h $dbHost -P $dbPort -u $dbUser -e "SELECT 1" 2>&1
Write-Host "Result: $test"

# If that fails, try common passwords
$passwords = @("", "root", "password", "admin", "mysql")
foreach ($pw in $passwords) {
    Write-Host ""
    Write-Host "=== Try password: '$pw' ===" -ForegroundColor Cyan
    $test = & $mysql -h $dbHost -P $dbPort -u $dbUser -p$pw $dbName -e "SELECT 1 as test" 2>&1
    if ($test -match "test" -or $test -match "1") {
        Write-Host "Password found: '$pw'" -ForegroundColor Green
        break
    }
}