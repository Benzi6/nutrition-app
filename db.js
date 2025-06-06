// db.js
console.log("💡 LOADED db.js from:", __filename);

const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',               // or '127.0.0.1'
  port: 3306,
  user: 'root',
  password: 'dbms',  
  database: 'nutrition_app'
});


console.log('▶️ DB config:', {
  host: connection.config.host,
  user: connection.config.user,
  password: connection.config.password ? '••••' : '(none)',
  database: connection.config.database
});

connection.connect(err => {
  if (err) {
    console.error('❌ DB connection error:', err);
    process.exit(1);
  }
  console.log('✅ Connected to MySQL as ID', connection.threadId);
});

module.exports = connection;
