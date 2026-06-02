UPDATE avatars SET status = 'deleted' WHERE id IN (
  'avatar_1779189634710_8jtccwzrl',
  'avatar_1779189470625_flh39ckpe',
  'avatar_1779188907386_b7h4q6sb1',
  'avatar_1779188694091_rt72etxto',
  'avatar_1779188071666_4xm5bayhv'
);

SELECT id, name, status, created_at FROM avatars WHERE user_id = '60a737a0-cac0-43f9-921c-0cfd503c3e93' ORDER BY created_at DESC;
