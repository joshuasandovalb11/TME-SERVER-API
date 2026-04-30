require('dotenv').config();
const sql = require('mssql');

const sqlConfigBuscarClientes = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  port: parseInt(process.env.DB_PORT),
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

const poolPromiseBuscarClientes = new sql.ConnectionPool(sqlConfigBuscarClientes)
  .connect()
  .then((pool) => {
    console.log('✅ Conectado a SQL Server (Módulo BUSCAR CLIENTES)');
    return pool;
  })
  .catch((err) => {
    console.error('❌ Error conexión BD Buscar Clientes:', err);
    process.exit(1);
  });

module.exports = {
  sql,
  poolPromiseBuscarClientes,
};