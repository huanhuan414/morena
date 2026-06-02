-- 添加缺失的字段
ALTER TABLE subscription_plans 
ADD COLUMN image_speed VARCHAR(20) DEFAULT 'normal' COMMENT '图片生成速度';

ALTER TABLE subscription_plans 
ADD COLUMN text_speed VARCHAR(20) DEFAULT 'normal' COMMENT '文本生成速度';
