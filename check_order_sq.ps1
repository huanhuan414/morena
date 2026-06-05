$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"

Write-Host "=== Check order status ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, title, status, is_paid FROM orders WHERE id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Check order square query logic ===" -ForegroundColor Yellow
Write-Host "Order square shows orders where:"
Write-Host "  - is_paid = 1"
Write-Host "  - status IN ('open', 'pending_dispatch', 'pending', ...)"
Write-Host "  - NOT EXISTS (order_assets with status NOT IN ('ready', 'failed'))"
Write-Host ""
Write-Host "Current order: status=$status, asset=ready" -ForegroundColor Cyan