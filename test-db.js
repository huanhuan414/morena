const mysql = require('mysql2/promise');
(async () => {
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: parseInt(process.env.MYSQL_PORT || '16033', 10),
    user: process.env.MYSQL_USER || 'mrl',
    password: process.env.MYSQL_PASSWORD || 'YOUR_MYSQL_PASSWORD',
    database: process.env.MYSQL_DATABASE || 'mrl'
  });
  const [rows] = await pool.query('SELECT id, order_id, avatar_id, publish_feedback FROM content_generation_requests WHERE order_id = ?', ['239dab14-294e-4708-8336-7a680845d409']);
  console.log('rows:', rows.length, JSON.stringify(rows[0], null, 2));
  process.exit(0);
})();
