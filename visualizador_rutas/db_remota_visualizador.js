const { sql, poolRemotoPromise } = require('../db_remota');

const poolPromiseRemota = poolRemotoPromise;

module.exports = { sql, poolPromiseRemota };
