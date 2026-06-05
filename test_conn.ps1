$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

Write-Host "=== Test MySQL ===" -ForegroundColor Cyan

# Try direct connection
$result = & $mysql --help 2>&1 | Select-String -First 1
Write-Host "MySQL client: $result"

# Try to connect without password
Write-Host ""
Write-Host "=== Try no password ===" -ForegroundColor Cyan
$result1 = & $mysql -u root 2>&1
Write-Host "Result: $($result1 | Select-Object -First 3)"

Write-Host ""
Write-Host "=== Try with password ===" -ForegroundColor Cyan
$result2 = & $mysql -u root -p123456 2>&1
Write-Host "Result: $($result2 | Select-Object -First 3)"