const { sql, poolRemotoBuscarClientesPromise } = require('../../db_remota_buscar_clientes');

async function obtenerCredencial(tipo) {
  const pool = await poolRemotoBuscarClientesPromise;
  const request = pool.request();
  request.input('tipo', sql.VarChar, tipo);

  const result = await request.query(`
    SELECT Valor FROM Credenciales WHERE Tipo = @tipo
  `);

  if (result.recordset.length === 0) {
    return null;
  }

  return { pin: result.recordset[0].Valor };
}

module.exports = {
  obtenerCredencial,
};