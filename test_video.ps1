$userId = "8d72ec4e-e1e4-4037-87b0-4877ffa90034"
$avatarId = "avatar_1779185280881_wtztd5oww"
Write-Host "1. Create video order"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h127.0.0.1 -P3306 -uroot -p123456 mrl -e "INSERT INTO orders (id, user_id, title, description, content_type, platforms, budget, status, is_paid, avatar_count, quantity_per_avatar, requirements, created_at) VALUES ('test_video_123456', '$userId', 'Test Video', 'Test video generation', 'video', '[\"douyin\"]', 50.00, 'assigned', 1, 1, '{}', NOW()) ON DUPLICATE KEY UPDATE id=id" 2>$null
Write-Host "Order done"
Write-Host ""
Write-Host "2. Create dispatch record"
$dispatchId = [guid]::NewGuid().ToString()
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h127.0.0.1 -P3306 -uroot -p123456 mrl -e "INSERT INTO order_dispatch_requests (id, order_id, avatar_id, status, created_at) VALUES ('$dispatchId', 'test_video_123456', '$avatarId', 'accepted', NOW())" 2>$null
Write-Host "Dispatch done: $dispatchId"
Write-Host ""
Write-Host "3. Create content generation record"
$contentId = "test_content_123456"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h127.0.0.1 -P3306 -uroot -p123456 mrl -e "INSERT INTO content_generation_requests (id, order_id, avatar_id, platform, content_type, status, content, created_at) VALUES ('$contentId', 'test_video_123456', '$avatarId', 'douyin', 'video', 'generating_video', 'Test script content', NOW())" 2>$null
Write-Host "Content done: $contentId"
Write-Host ""
Write-Host "4. Current status"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h127.0.0.1 -P3306 -uroot -p123456 mrl -e "SELECT id, status FROM orders WHERE id = 'test_video_123456'"
Write-Host "Order status"
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -h127.0.0.1 -P3306 -uroot -p123456 mrl -e "SELECT id, status FROM content_generation_requests WHERE id = '$contentId'"
Write-Host "Content status"
