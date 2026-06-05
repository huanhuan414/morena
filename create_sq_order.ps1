$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== Find recent user ===" -ForegroundColor Cyan
$query = "SELECT id, phone, nickname FROM users ORDER BY created_at DESC LIMIT 1"
$result = & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $query 2>&1
Write-Host "Result: $result"

# Extract user ID using regex
if ($result -match "([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})") {
    $userId = $Matches[0]
    Write-Host "User ID: $userId" -ForegroundColor Green
    
    # Create video order
    Write-Host ""
    Write-Host "=== Create video order for order square ===" -ForegroundColor Cyan
    $orderId = "sq_" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    $createOrderSql = "INSERT INTO orders (id, user_id, title, description, content_type, platforms, budget, status, is_paid, avatar_count, quantity_per_avatar, requirements, created_at) VALUES ('$orderId', '$userId', 'Video Order For Square', 'Test video', 'video', 'douyin', 50.00, 'open', 1, 1, '{}', NOW()) ON DUPLICATE KEY UPDATE id=id"
    & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $createOrderSql 2>$null | Out-Null
    Write-Host "Order created: $orderId" -ForegroundColor Green
    
    # Create ready asset (so order appears in square)
    $assetId = "asset_sq_" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
    $createAssetSql = "INSERT INTO order_assets (id, order_id, asset_type, source, platform, status, asset_url, prompt, created_at) VALUES ('$assetId', '$orderId', 'video', 'ai_generated', 'douyin', 'ready', 'https://voicsc.51webjs.com/user%2Ftest.mp4', 'prompt', NOW()) ON DUPLICATE KEY UPDATE id=id"
    & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $createAssetSql 2>$null | Out-Null
    Write-Host "Asset created: $assetId" -ForegroundColor Green
    
    Write-Host ""
    Write-Host "=== Verify ===" -ForegroundColor Cyan
    & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, status, is_paid FROM orders WHERE id = '$orderId'" 2>$null
} else {
    Write-Host "No user found" -ForegroundColor Red
}