const mysql = require('mysql2/promise');

async function query() {
  const connection = await mysql.createConnection({
    host: '180.184.205.74',
    port: 16033,
    user: 'mrl',
    password: 'SYDPHJB8aGBn83Eh',
    database: 'mrl'
  });

  // 1. 查找用户
  console.log('=== 1. 查找用户 ===');
  const [users] = await connection.query(
    "SELECT id, phone, name FROM users WHERE phone LIKE '%13043522122%' LIMIT 5"
  );
  console.table(users);

  if (users.length === 0) {
    console.log('未找到该手机号的用户');
    return;
  }

  const userId = users[0].id;
  console.log('\n用户ID:', userId);

  // 2. 查找该用户的分身
  console.log('\n=== 2. 查找该用户的分身 ===');
  const [avatars] = await connection.query(
    "SELECT id, name, user_id, status FROM avatars WHERE user_id = ? AND status = 'active'",
    [userId]
  );
  console.table(avatars);

  if (avatars.length === 0) {
    console.log('该用户没有活跃分身');
    return;
  }

  const avatarIds = avatars.map(a => a.id);

  // 3. 查找分身生成的内容
  console.log('\n=== 3. 查找分身生成的内容 ===');
  const [contents] = await connection.query(
    `SELECT
      c.id,
      c.order_id,
      c.avatar_id,
      c.content_type,
      c.platform,
      c.status,
      c.created_at,
      c.updated_at,
      a.name as avatar_name
    FROM content_generation_requests c
    LEFT JOIN avatars a ON c.avatar_id = a.id
    WHERE c.avatar_id IN (?)
    ORDER BY c.created_at DESC
    LIMIT 50`,
    [avatarIds]
  );
  console.table(contents);

  await connection.end();
}

query().catch(console.error);