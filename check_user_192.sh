#!/bin/bash
ssh root@180.184.205.74 "mysql -h 127.0.0.1 -P 16033 -u mrl -p'mrl_2024' mrl" << 'SQL'
SELECT id, phone, nickname, balance FROM users WHERE phone = '19236415655';
SQL
