// sistema_marketing/db_rutas_marketing.js
const { sql, poolPromiseRutas } = require('../db_rutas');

const poolRutasMarketing = poolPromiseRutas;

module.exports = { sql, poolRutasMarketing };