DROP TEMPORARY TABLE IF EXISTS tmp_earn_keep;
CREATE TEMPORARY TABLE tmp_earn_keep (
  order_id VARCHAR(36) NOT NULL,
  avatar_id VARCHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL,
  keep_id VARCHAR(36) NOT NULL,
  PRIMARY KEY(order_id, avatar_id, type)
);

INSERT INTO tmp_earn_keep(order_id, avatar_id, type, keep_id)
SELECT
  order_id,
  avatar_id,
  type,
  RIGHT(MAX(CONCAT(
    CASE
      WHEN status IN ('settled', 'completed') THEN '2'
      WHEN status IN ('pending') THEN '1'
      ELSE '0'
    END,
    DATE_FORMAT(IFNULL(updated_at, created_at), '%Y%m%d%H%i%s'),
    id
  )), 36) AS keep_id
FROM earnings
WHERE type = 'order_reward'
  AND order_id IS NOT NULL AND order_id <> ''
  AND avatar_id IS NOT NULL AND avatar_id <> '' AND avatar_id <> 'undefined'
GROUP BY order_id, avatar_id, type;

DELETE e
FROM earnings e
INNER JOIN tmp_earn_keep k
  ON k.order_id = e.order_id
 AND k.avatar_id = e.avatar_id
 AND k.type = e.type
WHERE e.type = 'order_reward'
  AND e.order_id IS NOT NULL AND e.order_id <> ''
  AND e.avatar_id IS NOT NULL AND e.avatar_id <> '' AND e.avatar_id <> 'undefined'
  AND e.id <> k.keep_id;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'earnings'
    AND index_name = 'uniq_earn_order_avatar_type'
);
SET @ddl := IF(
  @idx_exists = 0,
  'ALTER TABLE earnings ADD UNIQUE KEY uniq_earn_order_avatar_type (order_id, avatar_id, type)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
