$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$requestId = "req_1780038030436_jyoht4szw"

Write-Host "=== Full Content Generation Details ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT * FROM content_generation_requests WHERE id = '$requestId'" 2>$null