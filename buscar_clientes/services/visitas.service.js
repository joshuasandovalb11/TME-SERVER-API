const { sql, poolPromiseBuscarClientes } = require('../db_buscar_clientes');

async function obtenerVisitas(deviceId) {
  const pool = await poolPromiseBuscarClientes;
  const request = pool.request();
  request.input('deviceId', sql.VarChar, deviceId);

  const result = await request.query(`
    SELECT ClienteID, SucursalID 
    FROM VisitasSupervisores 
    WHERE DeviceID = @deviceId
  `);

  return result.recordset.map((row) => `${row.ClienteID}-${row.SucursalID || 0}`);
}

async function alternarVisita({ deviceId, clienteId, sucursalId, sucursalNombre }) {
  const pool = await poolPromiseBuscarClientes;
  const request = pool.request();

  const sucId = sucursalId ? parseInt(sucursalId) : 0;
  const sucNombre = sucursalNombre || '';

  request.input('deviceId', sql.VarChar, deviceId);
  request.input('clienteId', sql.Int, parseInt(clienteId));
  request.input('sucursalId', sql.Int, sucId);
  request.input('sucursalNombre', sql.VarChar, sucNombre);

  const check = await request.query(`
    SELECT ID FROM VisitasSupervisores 
    WHERE DeviceID = @deviceId AND ClienteID = @clienteId AND SucursalID = @sucursalId
  `);

  if (check.recordset.length > 0) {
    return { visitado: true, message: 'El cliente ya estaba visitado previamente.' };
  }

  await request.query(`
    INSERT INTO VisitasSupervisores (DeviceID, ClienteID, SucursalID, SucursalNombre, FechaVisita)
    VALUES (@deviceId, @clienteId, @sucursalId, @sucursalNombre, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific Standard Time' AS DATETIME))
  `);

  return { visitado: true, message: 'Visita guardada correctamente con hora local.' };
}

async function obtenerHistorial(deviceId) {
  const pool = await poolPromiseBuscarClientes;
  const request = pool.request();
  request.input('deviceId', sql.VarChar, deviceId);

  const result = await request.query(`
    SELECT 
      v.ClienteID, 
      v.SucursalID, 
      v.SucursalNombre, 
      v.FechaVisita,
      MAX(c.NombreCliente) as NombreCliente,
      MAX(c.Vend) as Vendedor
    FROM VisitasSupervisores v
    LEFT JOIN Clientes c 
      ON v.ClienteID = c.ClienteID 
      AND ISNULL(v.SucursalID, 0) = ISNULL(c.SucursalID, 0)
    WHERE v.DeviceID = @deviceId
    GROUP BY v.ClienteID, v.SucursalID, v.SucursalNombre, v.FechaVisita
    ORDER BY v.FechaVisita DESC
  `);

  return result.recordset;
}

async function resetearVisitas(deviceId) {
  const pool = await poolPromiseBuscarClientes;
  const request = pool.request();
  request.input('deviceId', sql.VarChar, deviceId);

  await request.query(`
    DELETE FROM VisitasSupervisores 
    WHERE DeviceID = @deviceId
  `);
}

module.exports = {
  obtenerVisitas,
  alternarVisita,
  obtenerHistorial,
  resetearVisitas,
};