$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"
$dbHost = "127.0.0.1"
$dbPort = "3306"
$dbUser = "root"
$dbPass = "123456"
$dbName = "mrl"

Write-Host "=== 1. Create video order ===" -ForegroundColor Cyan
$sql1 = "INSERT INTO orders (id, user_id, title, description, content_type, platforms, budget, status, is_paid, avatar_count, quantity_per_avatar, requirements, created_at) VALUES ('test_video_123456', '8d72ec4e-e1e4-4037-87b0-4877ffa90034', 'Test Video', 'Test desc', 'video', 'douyin', 50.00, 'assigned', 1, 1, '{}', NOW()) ON DUPLICATE KEY UPDATE id=id"
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $sql1
Write-Host "Order done" -ForegroundColor Green

Write-Host ""
Write-Host "=== 2. Create dispatch record ===" -ForegroundColor Cyan
$dispatchId = [guid]::NewGuid().ToString()
$sql2 = "INSERT INTO order_dispatch_requests (id, order_id, avatar_id, status, created_at) VALUES ('$dispatchId', 'test_video_123456', 'avatar_1779185280881_wtztd5oww', 'accepted', NOW())"
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $sql2
Write-Host "Dispatch done: $dispatchId" -ForegroundColor Green

Write-Host ""
Write-Host "=== 3. Create content generation record ===" -ForegroundColor Cyan
$contentId = "test_content_123456"
$sql3 = "INSERT INTO content_generation_requests (id, order_id, avatar_id, platform, content_type, status, content, created_at) VALUES ('$contentId', 'test_video_123456', 'avatar_1779185280881_wtztd5oww', 'douyin', 'video', 'generating_video', 'Test script', NOW())"
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e $sql3
Write-Host "Content done: $contentId" -ForegroundColor Green

Write-Host ""
Write-Host "=== Current Status ===" -ForegroundColor Yellow
Write-Host ""
Write-Host "Order:"
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, title, content_type, status FROM orders WHERE id = 'test_video_123456'"

Write-Host ""
Write-Host "Content:"
& $mysql -h $dbHost -P $dbPort -u $dbUser -p$dbPass $dbName -e "SELECT id, status, video_url, seedance_task_id FROM content_generation_requests WHERE id = 'test_content_123456'"

Write-Host ""
Write-Host "=== Done ===" -ForegroundColor Green
Write-Host "Restart backend to trigger video generation" -ForegroundColor Yellow
