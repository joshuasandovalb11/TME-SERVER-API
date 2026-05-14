// visualizador_rutas/tests/rutas_integration.test.js
const assert = require('node:assert/strict');
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');
const { poolPromiseRemota } = require('../db_remota_visualizador');
const {
  parseRawEventsJson,
  buildProcessedTripPayload
} = require('../services/ruta_mapper');

async function fetchLatestRouteRow() {
  const pool = await poolPromiseRutas;
  const result = await pool.request().query(`
    SELECT TOP 1
      rd.id_ruta_diaria,
      CAST(rd.fecha AS DATE) AS fecha,
      COALESCE(vend.id_vendedor, rd.id_vendedor) AS id_vendedor,
      vend.nombre AS nombre_vendedor,
      v.placa,
      v.descripcion AS vehiculo,
      CAST(DECOMPRESS(rd.datos_ruta) AS VARCHAR(MAX)) AS datos_ruta
    FROM rutas_diarias rd
    INNER JOIN vehiculos v ON v.id_vehiculo = rd.id_vehiculo
    LEFT JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
    ORDER BY rd.fecha DESC, rd.id_ruta_diaria DESC
  `);

  return result.recordset[0] || null;
}

async function fetchViajes(idRuta) {
  const pool = await poolPromiseRutas;
  const result = await pool.request()
    .input('id', sql.Int, idRuta)
    .query(`
      SELECT
        hora_inicio,
        latitud_inicio,
        longitud_inicio,
        hora_fin,
        latitud_final,
        longitud_final
      FROM viajes
      WHERE id_ruta_diaria = @id
      ORDER BY hora_inicio ASC
    `);

  return result.recordset;
}

async function fetchClientesByVendedor(vendedorId) {
  if (!vendedorId) return [];

  try {
    const pool = await poolPromiseRemota;
    const result = await pool.request()
      .input('vend', sql.VarChar(50), vendedorId)
      .query(`
        WITH PuntosCliente AS (
          SELECT
            c.ID_CLIENTE,
            0 AS ID_SUCURSAL,
            CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
            CAST(c.ID_VEND_1 AS VARCHAR(50)) AS Vend,
            CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
            CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON
          FROM PBIT_CLIENTES_2 c
          WHERE c.ID_VEND_1 = @vend

          UNION ALL

          SELECT
            s.ID_CLIENTE,
            s.ID_SUCURSAL,
            CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
            CAST(s.ID_VENDEDOR AS VARCHAR(50)) AS Vend,
            CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
            CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON
          FROM PBIT_SUCURSALES_2 s
          INNER JOIN PBIT_CLIENTES_2 c ON s.ID_CLIENTE = c.ID_CLIENTE
          WHERE s.ID_VENDEDOR = @vend
        )
        SELECT ID_CLIENTE, ID_SUCURSAL, NombreCliente, Vend, GPS_LAT, GPS_LON
        FROM PuntosCliente
        WHERE GPS_LAT IS NOT NULL AND GPS_LON IS NOT NULL
      `);

    return result.recordset.map((row) => ({
      key: String(row.ID_CLIENTE).trim(),
      branchNumber: String(row.ID_SUCURSAL || 0).trim(),
      name: String(row.NombreCliente || '').trim(),
      vendor: String(row.Vend || '').trim(),
      lat: Number(row.GPS_LAT),
      lng: Number(row.GPS_LON)
    }));
  } catch (error) {
    console.warn('[integration] No se pudieron cargar clientes remotos:', error.message || error);
    return [];
  }
}

function assertProcessedTripShape(payload, includeSource = false) {
  assert.equal(typeof payload.idRuta, 'number');
  assert.equal(typeof payload.fecha, 'string');
  assert.equal(typeof payload.vehiculo, 'string');
  assert.ok(Array.isArray(payload.events));
  assert.ok(Array.isArray(payload.path));
  assert.ok(Array.isArray(payload.flags));
  assert.ok(payload.summary && typeof payload.summary === 'object');
  assert.ok(Array.isArray(payload.clients));
  
  // El source se agrega a nivel HTTP, no en el mapper
  if (includeSource) {
    assert.ok(payload.source && ['database', 'excel-file'].includes(payload.source));
  }
}

async function run() {
  const row = await fetchLatestRouteRow();
  if (!row) {
    console.log('No hay rutas en la base para probar.');
    return;
  }

  const viajesAnaliticos = await fetchViajes(row.id_ruta_diaria);
  const rawEvents = parseRawEventsJson(row.datos_ruta);
  const clientes = await fetchClientesByVendedor(row.id_vendedor);

  const payload = buildProcessedTripPayload({
    row,
    viajesAnaliticos,
    rawEvents,
    minStopDuration: 5,
    clientes
  });

  assertProcessedTripShape(payload);

  console.log('OK: integración real de rutas');
  console.log(JSON.stringify({
    idRuta: payload.idRuta,
    fecha: payload.fecha,
    vendedor: payload.vendedor,
    vehiculo: payload.vehiculo,
    events: payload.events.length,
    pathPoints: payload.path.length,
    flags: payload.flags.length,
    viajesAnaliticos: payload.viajesAnaliticos.length,
    clients: payload.clients.length,
    summary: payload.summary
  }, null, 2));
}

run().catch((error) => {
  console.error('FAIL: integración real de rutas');
  console.error(error);
  process.exitCode = 1;
});
