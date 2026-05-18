SELECT id, phone, balance, frozen_balance, total_earnings, created_at FROM users WHERE phone = '13043522122';
SELECT * FROM earnings WHERE user_id IN (SELECT id FROM users WHERE phone = '13043522122');
