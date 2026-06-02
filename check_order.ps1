$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"

Write-Host "=== Order Info ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, content_type, status, is_paid, created_at FROM orders WHERE id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Order Assets ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, asset_type, status, asset_url, seedance_task_id, source, created_at FROM order_assets WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Dispatch Records ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, avatar_id, status, created_at FROM order_dispatch_requests WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Content Generation Requests ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, status, content, video_url, seedance_task_id, created_at FROM content_generation_requests WHERE order_id = '$orderId'" 2>$null