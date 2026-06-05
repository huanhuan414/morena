$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"

Write-Host "=== Simulate pregenerate: create order_assets ===" -ForegroundColor Cyan

# Create video asset record
$assetId = "asset_" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$sql = "INSERT INTO order_assets (id, order_id, asset_type, source, platform, status, prompt, created_at) VALUES ('$assetId', '$orderId', 'video', 'ai_generated', 'douyin', 'generating', 'Test video asset', NOW())"
& $mysql -u root -p123456 mrl -e $sql 2>$null | Out-Null
Write-Host "Created asset: $assetId (status=generating)" -ForegroundColor Green

# Update order status to open (so it appears in square)
$sql2 = "UPDATE orders SET status = 'open' WHERE id = '$orderId'"
& $mysql -u root -p123456 mrl -e $sql2 2>$null | Out-Null
Write-Host "Updated order status to: open" -ForegroundColor Green

Write-Host ""
Write-Host "=== Verify ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, status, is_paid FROM orders WHERE id = '$orderId'" 2>$null
Write-Host ""
& $mysql -u root -p123456 mrl -e "SELECT id, asset_type, status, seedance_task_id FROM order_assets WHERE order_id = '$orderId'" 2>$null

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Order should now appear in square (status=open, asset=generating)" -ForegroundColor Yellow
Write-Host "When Seedance task completes, pollPendingVideoTasks will update asset_url" -ForegroundColor Yellow