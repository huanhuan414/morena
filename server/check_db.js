const mysql = require('mysql2/promise');

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 16033,
    user: 'mrl',
    password: 'SYDPHJB8aGBn83Eh',
    database: 'mrl'
  });

  const tables = ['orders', 'order_dispatch_requests', 'content_generation_requests', 'avatars', 'users'];

  for (const table of tables) {
    console.log(`\n=== ${table} ===`);
    const [fields] = await connection.query(`DESCRIBE ${table}`);
    fields.forEach(f => {
      console.log(`${f.Field}: ${f.Type} ${f.Null === 'YES' ? '(nullable)' : ''} ${f.Key} ${f.Default ? 'default: ' + f.Default : ''}`);
    });
  }

  await connection.end();
}

checkDatabase().catch(console.error);