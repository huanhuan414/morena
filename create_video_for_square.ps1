$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== Step 1: Find user by phone 13043522122 ===" -ForegroundColor Cyan
$result = & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, phone, nickname FROM users WHERE phone = '13043522122' LIMIT 1" 2>$null
if ($result -match "(\w{8}-\w{4}-\w{4}-\w{4}-\w{12})") {
    $userId = $Matches[0]
    Write-Host "Found user: $userId" -ForegroundColor Green
} else {
    Write-Host "User not found, please check" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "=== Step 2: Find active avatar for this user ===" -ForegroundColor Cyan
$avatarResult = & $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, name FROM avatars WHERE user_id = '$userId' AND status = 'active' LIMIT 1" 2>$null
$avatarId = $null
if ($avatarResult -match "(avatar_\d+_\w+)") {
    $avatarId = $Matches[0]
    Write-Host "Found avatar: $avatarId" -ForegroundColor Green
} else {
    Write-Host "No active avatar found, will create order without avatar" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Step 3: Create video order (is_paid=1, status=open) ===" -ForegroundColor Cyan
$orderId = "test_video_sq_" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
$createOrderSql = @"
INSERT INTO orders (id, user_id, title, description, content_type, platforms, budget, status, is_paid, avatar_count, quantity_per_avatar, requirements, created_at)
VALUES ('$orderId', '$userId', 'Test Video Order', 'Test video for order square', 'video', '["douyin"]', 50.00, 'open', 1, 1, '{}', NOW())
ON DUPLICATE KEY UPDATE id=id
"@
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $createOrderSql 2>$null | Out-Null
Write-Host "Order created: $orderId" -ForegroundColor Green

Write-Host ""
Write-Host "=== Step 4: Create order_assets (status=ready, so order appears in square) ===" -ForegroundColor Cyan
$assetId = "asset_" + [DateTimeOffset]::Now.ToUnixTimeMilliseconds() + "_test"
$createAssetSql = @"
INSERT INTO order_assets (id, order_id, asset_type, source, platform, status, asset_url, prompt, created_at)
VALUES ('$assetId', '$orderId', 'video', 'ai_generated', 'douyin', 'ready', 'https://voicsc.51webjs.com/user%2Ftest_video.mp4', 'Test video prompt', NOW())
ON DUPLICATE KEY UPDATE id=id
"@
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $createAssetSql 2>$null | Out-Null
Write-Host "Asset created: $assetId" -ForegroundColor Green

Write-Host ""
Write-Host "=== Step 5: Verify order appears in square ===" -ForegroundColor Cyan
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, status, is_paid FROM orders WHERE id = '$orderId'"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Order ID: $orderId" -ForegroundColor Yellow
Write-Host "Now this order should appear in the order square!" -ForegroundColor Yellow