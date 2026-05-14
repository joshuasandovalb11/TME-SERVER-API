const { sql, poolPromiseMapas } = require('../db_mapas');

const poolPromiseBuscarClientes = poolPromiseMapas;

module.exports = { sql, poolPromiseBuscarClientes };