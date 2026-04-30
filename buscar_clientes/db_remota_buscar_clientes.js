require('dotenv').config();
const sql = require('mssql');

const sqlConfigRemotaBuscarClientes = {
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
    idleTimeoutMillis: 30000,
  },
};

const poolRemotoBuscarClientesPromise = new sql.ConnectionPool(sqlConfigRemotaBuscarClientes)
  .connect()
  .then((pool) => {
    console.log('✅ Conectado a SQL Server REMOTO (Módulo BUSCAR CLIENTES)');
    return pool;
  })
  .catch((err) => {
    console.error('❌ Error conexión BD remota de Buscar Clientes:', err.message);
    process.exit(1);
  });

module.exports = { sql, poolRemotoBuscarClientesPromise };