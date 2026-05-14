require('dotenv').config();
const sql = require('mssql');

const sqlConfigMapas = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT || '1433', 10),
  database: process.env.DB_DATABASE,
  options: {
    encrypt: false,
    trustServerCertificate: true,
    enableArithAbort: true,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

const poolPromiseMapas = new sql.ConnectionPool(sqlConfigMapas)
  .connect()
  .then((pool) => {
    console.log('✅ Conectado a SQL Server (Maps)');
    return pool;
  })
  .catch((err) => {
    console.error('❌ Error conexión BD Maps:', err.message || err);
    throw err;
  });

module.exports = { sql, poolPromiseMapas };
