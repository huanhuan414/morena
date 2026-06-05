-- 添加缺失的字段（MySQL 5.7兼容版）
ALTER TABLE subscription_plans ADD COLUMN image_speed VARCHAR(20) DEFAULT 'normal' COMMENT '图片生成速度';

ALTER TABLE subscription_plans ADD COLUMN text_speed VARCHAR(20) DEFAULT 'normal' COMMENT '文本生成速度';

ALTER TABLE subscription_plans ADD COLUMN video_speed VARCHAR(20) DEFAULT 'normal' COMMENT '视频生成速度';
