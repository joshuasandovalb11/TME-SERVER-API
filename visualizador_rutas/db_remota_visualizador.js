const sql = require('mssql');

const configRemota = {
  user: process.env.DB_USER_REMOTA,
  password: process.env.DB_PASSWORD_REMOTA,
  server: process.env.DB_SERVER_REMOTA,
  database: process.env.DB_DATABASE_REMOTA,
  port: parseInt(process.env.DB_PORT_REMOTA || '1433', 10),
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  pool: { max: 10, min: 0, idleTimeoutMillis: 30000 }
};

const poolPromiseRemota = new sql.ConnectionPool(configRemota).connect().then(pool => {
  console.log('✅ Conectado a SQL Server REMOTO (Módulo VISUALIZADOR RUTAS)');
  return pool;
}).catch(err => {
  console.error('PBI remote DB connection failed:', err.message || err);
  throw err;
});

module.exports = { sql, poolPromiseRemota };
