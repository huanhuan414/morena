-- 检查subscription_plans表的所有字段
SELECT COLUMN_NAME FROM information_schema.COLUMNS 
WHERE TABLE_SCHEMA = 'mrl' AND TABLE_NAME = 'subscription_plans' 
ORDER BY ORDINAL_POSITION;

-- 添加缺失的video_speed字段
ALTER TABLE subscription_plans ADD COLUMN video_speed VARCHAR(20) DEFAULT 'normal' COMMENT '视频生成速度';
