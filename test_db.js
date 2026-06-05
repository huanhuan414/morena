const mysql = require('mysql2');
const pool = mysql.createPool({
  host: '180.184.205.74',
  port: 16033,
  user: 'mrl',
  password: 'SYDPHJB8aGBn83Eh',
  database: 'mrl'
});

pool.query('SELECT content_type, base_price, is_active FROM content_type_prices WHERE is_active = TRUE', (err, rows) => {
  if (err) {
    console.error('Error:', err.message);
  } else {
    console.log('Rows count:', rows.length);
    console.log('Data:', JSON.stringify(rows, null, 2));
  }
  pool.end();
});
