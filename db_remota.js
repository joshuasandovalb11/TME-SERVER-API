require('dotenv').config();
const sql = require('mssql');

const sqlConfigRemota = {
  user: process.env.DB_USER_REMOTA,
  password: process.env.DB_PASSWORD_REMOTA,
  server: process.env.DB_SERVER_REMOTA,
  port: parseInt(process.env.DB_PORT_REMOTA || '1433', 10),
  database: process.env.DB_DATABASE_REMOTA,
  connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT_REMOTA || '30000', 10),
  requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT_REMOTA || '30000', 10),
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

const RETRY_BASE_MS = parseInt(process.env.DB_RETRY_BASE_MS_REMOTA || '5000', 10);
const RETRY_MAX_MS = parseInt(process.env.DB_RETRY_MAX_MS_REMOTA || '60000', 10);

let poolRemotoPromise = null;
let retryDelayMs = RETRY_BASE_MS;

function connectRemotePool() {
  poolRemotoPromise = new sql.ConnectionPool(sqlConfigRemota)
    .connect()
    .then((pool) => {
      console.log('✅ Conectado a SQL Server REMOTO (Power BI)');
      retryDelayMs = RETRY_BASE_MS;
      return pool;
    })
    .catch((err) => {
      console.error('❌ Error conexión BD Remota:', err.message || err);
      const waitMs = Math.min(retryDelayMs, RETRY_MAX_MS);
      retryDelayMs = Math.min(retryDelayMs * 2, RETRY_MAX_MS);
      setTimeout(connectRemotePool, waitMs);
      throw err;
    });

  return poolRemotoPromise;
}

connectRemotePool();

module.exports = { sql, poolRemotoPromise };
