-- 核心表结构分析

-- 1. 用户表
SHOW COLUMNS FROM users;

-- 2. 分身表
SHOW COLUMNS FROM avatars;

-- 3. 订单表
SHOW COLUMNS FROM orders;

-- 4. 派单请求表
SHOW COLUMNS FROM order_dispatch_requests;

-- 5. 内容生成请求表
SHOW COLUMNS FROM content_generation_requests;

-- 6. 收益表
SHOW COLUMNS FROM earnings;

-- 7. 订单事件表
SHOW COLUMNS FROM order_events;
