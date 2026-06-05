# MySQL 连接信息
$mysqlUser = "root"
$mysqlPassword = "123456"
$mysqlHost = "127.0.0.1"
$mysqlPort = "3306"
$mysqlDatabase = "mrl"

# 用户信息
$userId = "8d72ec4e-e1e4-4037-87b0-4877ffa90034"
$avatarId = "avatar_1779185280881_wtztd5oww"

Write-Host "=== 1. 创建视频订单 ===" -ForegroundColor Cyan

$createOrderSql = @"
INSERT INTO orders (id, user_id, title, description, content_type, platforms, budget, status, is_paid, avatar_count, quantity_per_avatar, requirements, created_at)
VALUES ('test_video_123456', '$userId', '测试视频生成', '这是一个测试短视频生成', 'video', '["douyin"]', 50.00, 'assigned', 1, 1, '{}', NOW())
"@

# 执行 SQL
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h$mysqlHost -P$mysqlPort -u$mysqlUser -p$mysqlPassword $mysqlDatabase -e $createOrderSql 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "订单创建成功" -ForegroundColor Green
} else {
    Write-Host "订单可能已存在或创建失败" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 2. 创建分身接单记录 ===" -ForegroundColor Cyan

$dispatchId = [guid]::NewGuid().ToString()

$createDispatchSql = @"
INSERT INTO order_dispatch_requests (id, order_id, avatar_id, status, created_at)
VALUES ('$dispatchId', 'test_video_123456', '$avatarId', 'accepted', NOW())
"@

& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h$mysqlHost -P$mysqlPort -u$mysqlUser -p$mysqlPassword $mysqlDatabase -e $createDispatchSql 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "接单记录创建成功，dispatch_id: $dispatchId" -ForegroundColor Green
} else {
    Write-Host "接单记录可能已存在或创建失败" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 3. 创建内容生成记录 ===" -ForegroundColor Cyan

$contentId = "test_content_123456"
$createContentSql = @"
INSERT INTO content_generation_requests (id, order_id, avatar_id, platform, content_type, status, content, created_at)
VALUES ('$contentId', 'test_video_123456', '$avatarId', 'douyin', 'video', 'generating_video', '测试视频脚本内容', NOW())
"@

& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h$mysqlHost -P$mysqlPort -u$mysqlUser -p$mysqlPassword $mysqlDatabase -e $createContentSql 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "内容生成记录创建成功，content_id: $contentId" -ForegroundColor Green
} else {
    Write-Host "内容生成记录可能已存在或创建失败" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== 4. 查询当前状态 ===" -ForegroundColor Cyan

Write-Host "`n订单信息:"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h$mysqlHost -P$mysqlPort -u$mysqlUser -p$mysqlPassword $mysqlDatabase -e "SELECT id, title, content_type, status, is_paid FROM orders WHERE id = 'test_video_123456'"

Write-Host "`n接单信息:"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h$mysqlHost -P$mysqlPort -u$mysqlUser -p$mysqlPassword $mysqlDatabase -e "SELECT id, order_id, avatar_id, status FROM order_dispatch_requests WHERE order_id = 'test_video_123456'"

Write-Host "`n内容生成信息:"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h$mysqlHost -P$mysqlPort -u$mysqlUser -p$mysqlPassword $mysqlDatabase -e "SELECT id, order_id, status, video_url, seedance_task_id FROM content_generation_requests WHERE order_id = 'test_video_123456'"

Write-Host ""
Write-Host "=== 测试数据创建完成 ===" -ForegroundColor Green
Write-Host "请重启后端服务，然后检查日志观察视频生成流程" -ForegroundColor Yellow
