$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "SYDPHJB8aGBn83Eh"
$dbName = "mrl"

Write-Host "=== Test with different password ===" -ForegroundColor Cyan
$test = & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass -e "SELECT 1 as test" 2>&1
Write-Host "Result: $test"

if ($test -match "test") {
    Write-Host "Connected!" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "=== Check Order ===" -ForegroundColor Cyan
    & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, content_type, status, is_paid FROM orders WHERE id = 'd6209941-42e2-45c6-8c2c-b52ad48fff5b'" 2>$null
    
    Write-Host ""
    Write-Host "=== Check Order Assets ===" -ForegroundColor Cyan
    & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, asset_type, status, asset_url FROM order_assets WHERE order_id = 'd6209941-42e2-45c6-8c2c-b52ad48fff5b'" 2>$null
} else {
    Write-Host "Still failing: $test" -ForegroundColor Red
}