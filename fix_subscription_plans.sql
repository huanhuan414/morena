ALTER TABLE subscription_plans 
ADD COLUMN daily_order_limit INT DEFAULT 999999 COMMENT '每日订单限制',
ADD COLUMN platform_fee_rate DECIMAL(5,4) DEFAULT 0.2000 COMMENT '平台费率',
ADD COLUMN custom_avatar_accept TINYINT(1) DEFAULT 0 COMMENT '是否允许自定义分身接单';

UPDATE subscription_plans SET daily_order_limit = 20, platform_fee_rate = 0.1500, custom_avatar_accept = 0, can_receive_orders = 1 WHERE id = 'plan_basic';
UPDATE subscription_plans SET daily_order_limit = 999999, platform_fee_rate = 0.0500, custom_avatar_accept = 1, can_receive_orders = 1 WHERE id = 'plan_enterprise';
UPDATE subscription_plans SET daily_order_limit = 5, platform_fee_rate = 0.2000, custom_avatar_accept = 0, can_receive_orders = 1 WHERE id = 'plan_free';
UPDATE subscription_plans SET daily_order_limit = 999999, platform_fee_rate = 0.1000, custom_avatar_accept = 1, can_receive_orders = 1 WHERE id = 'plan_pro';