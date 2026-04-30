// sistema_marketing/db_remota.js
const sql = require('mssql');

const sqlConfigRemota = {
  user: process.env.DB_USER_REMOTA,
  password: process.env.DB_PASSWORD_REMOTA,
  server: process.env.DB_SERVER_REMOTA,
  port: parseInt(process.env.DB_PORT_REMOTA) || 1433,
  database: process.env.DB_DATABASE_REMOTA,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  }
};

const poolRemotoPromise = new sql.ConnectionPool(sqlConfigRemota)
  .connect()
  .then(pool => {
    console.log('✅ Conectado a SQL Server REMOTO (Power BI)');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error conexión BD Remota:', err.message);
  });

module.exports = { sql, poolRemotoPromise };