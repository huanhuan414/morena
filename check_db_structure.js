const mysql = require('mysql2/promise');

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: '180.184.205.74',
    port: 16033,
    user: 'mrl',
    password: 'SYDPHJB8aGBn83Eh',
    database: 'mrl'
  });

  const tables = ['orders', 'order_dispatch_requests', 'content_generation_requests', 'avatars', 'users'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const [fields] = await connection.query(`DESCRIBE ${table}`);
    console.table(fields.map(f => ({
      Field: f.Field,
      Type: f.Type,
      Null: f.Null,
      Key: f.Key,
      Default: f.Default
    })));
  }

  await connection.end();
}

checkDatabase().catch(console.error);