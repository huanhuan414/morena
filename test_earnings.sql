SELECT avatar_id, SUM(amount) as total_earnings FROM earnings WHERE avatar_id = 'avatar_1779076077564_8g4wkd0xy' AND status IN ('settled', 'completed') GROUP BY avatar_id;
