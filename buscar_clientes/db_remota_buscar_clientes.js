const { sql, poolRemotoPromise } = require('../db_remota');

const poolRemotoBuscarClientesPromise = poolRemotoPromise;

module.exports = { sql, poolRemotoBuscarClientesPromise };