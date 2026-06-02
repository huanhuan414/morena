$mysql = "D:\BtSoft\mysql\MySQL5.7\bin\mysql.exe"

$orderId = "d6209941-42e2-45c6-8c2c-b52ad48fff5b"

Write-Host "=== 订单信息 ===" -ForegroundColor Cyan
& $mysql -u root -p123456 mrl -e "SELECT id, title, description FROM orders WHERE id = '$orderId'" 2>$null