require('dotenv').config();
const sql = require("mssql");

const sqlConfigRutas = {
  user: process.env.DB_USER_RUTAS,
  password: process.env.DB_PASSWORD_RUTAS,
  server: process.env.DB_SERVER_RUTAS,
  port: parseInt(process.env.DB_PORT_RUTAS),
  database: process.env.DB_DATABASE_RUTAS,
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

const poolPromiseRutas = new sql.ConnectionPool(sqlConfigRutas)
  .connect()
  .then(pool => {
    console.log('✅ Conectado a SQL Server (Módulo RUTAS)');
    return pool;
  })
  .catch(err => {
    console.error('❌ Error conexión BD Rutas:', err);
  });

module.exports = {
  sql,
  poolPromiseRutas
};