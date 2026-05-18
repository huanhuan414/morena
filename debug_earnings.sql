SELECT avatar_id, total_earnings, today_earnings FROM (
  SELECT 
    avatar_id,
    SUM(amount) as total_earnings,
    SUM(CASE WHEN created_at >= '2026-05-18 00:00:00' THEN amount ELSE 0 END) as today_earnings
  FROM earnings 
  WHERE avatar_id = 'avatar_1779076077564_8g4wkd0xy' AND status IN ('settled', 'completed')
  GROUP BY avatar_id
) as t;
