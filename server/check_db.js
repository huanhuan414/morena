const mysql = require('mysql2/promise');

async function checkDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '16033', 10),
    user: process.env.MYSQL_USER || 'mrl',
    password: process.env.MYSQL_PASSWORD || 'YOUR_MYSQL_PASSWORD',
    database: process.env.MYSQL_DATABASE || 'mrl'
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
