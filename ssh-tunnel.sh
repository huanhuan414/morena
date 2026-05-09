#!/bin/bash
# SSH隧道脚本 - 将远程MySQL端口转发到本地
sshpass -f /tmp/pwd.txt ssh -L 3306:127.0.0.1:16033 -o StrictHostKeyChecking=no -N root@180.184.205.74 &
SSH_TUNNEL_PID=$!
echo "SSH Tunnel PID: $SSH_TUNNEL_PID"
sleep 2
# 测试连接
mysql -h 127.0.0.1 -P 3306 -u mrl -pSYDPHJB8aGBn83Eh -e "SELECT 1" 2>/dev/null && echo "MySQL connection successful" || echo "MySQL connection failed"
