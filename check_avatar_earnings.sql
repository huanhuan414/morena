SELECT e.id, e.avatar_id, a.id as avatar_id_in_table, a.name as avatar_name, e.amount, e.status FROM earnings e LEFT JOIN avatars a ON e.avatar_id = a.id WHERE e.user_id = 'a57b7f32-b713-464e-9a8b-6fec26eb4db8';
SELECT id, name FROM avatars WHERE user_id = 'a57b7f32-b713-464e-9a8b-6fec26eb4db8';
