UPDATE orders
SET avatar_count = CASE
  WHEN IFNULL(avatar_count, 0) <= 0 THEN GREATEST(IFNULL(expected_quantity, 1), 1)
  ELSE avatar_count
END,
updated_at = NOW()
WHERE IFNULL(avatar_count, 0) <= 0;

DROP TEMPORARY TABLE IF EXISTS tmp_odr_keep;
CREATE TEMPORARY TABLE tmp_odr_keep (
  order_id VARCHAR(36) NOT NULL,
  avatar_id VARCHAR(36) NOT NULL,
  keep_id VARCHAR(36) NOT NULL,
  PRIMARY KEY(order_id, avatar_id)
);

INSERT INTO tmp_odr_keep(order_id, avatar_id, keep_id)
SELECT
  order_id,
  avatar_id,
  RIGHT(MAX(CONCAT(
    CASE
      WHEN status IN ('completed', 'done', 'settled') THEN '3'
      WHEN status IN ('accepted', 'in_progress') THEN '2'
      WHEN status IN ('pending') THEN '1'
      ELSE '0'
    END,
    DATE_FORMAT(IFNULL(updated_at, created_at), '%Y%m%d%H%i%s'),
    id
  )), 36) AS keep_id
FROM order_dispatch_requests
WHERE avatar_id IS NOT NULL
  AND avatar_id <> ''
  AND avatar_id <> 'undefined'
GROUP BY order_id, avatar_id;

DELETE d
FROM order_dispatch_requests d
INNER JOIN tmp_odr_keep k
  ON k.order_id = d.order_id
 AND k.avatar_id = d.avatar_id
WHERE d.avatar_id IS NOT NULL
  AND d.avatar_id <> ''
  AND d.avatar_id <> 'undefined'
  AND d.id <> k.keep_id;

SET @idx_exists := (
  SELECT COUNT(1)
  FROM information_schema.statistics
  WHERE table_schema = DATABASE()
    AND table_name = 'order_dispatch_requests'
    AND index_name = 'uniq_order_avatar'
);
SET @ddl := IF(
  @idx_exists = 0,
  'ALTER TABLE order_dispatch_requests ADD UNIQUE KEY uniq_order_avatar (order_id, avatar_id)',
  'SELECT 1'
);
PREPARE stmt FROM @ddl;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
