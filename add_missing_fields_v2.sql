-- 添加缺失的字段
ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS image_speed VARCHAR(20) DEFAULT 'normal' COMMENT '图片生成速度';

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS text_speed VARCHAR(20) DEFAULT 'normal' COMMENT '文本生成速度';

ALTER TABLE subscription_plans 
ADD COLUMN IF NOT EXISTS video_speed VARCHAR(20) DEFAULT 'normal' COMMENT '视频生成速度';
