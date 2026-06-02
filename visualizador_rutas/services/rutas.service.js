// visualizador_rutas/services/rutas.service.js
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');
const { poolPromiseRemota } = require('../db_remota_visualizador');
const {
  toBool,
  parseRawEventsJson,
  buildProcessedTripPayload
} = require('./ruta_mapper');

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

async function fetchClientesByVendedor(vendedorId) {
  if (!vendedorId) return [];

  try {
    const { poolPromiseRemota } = require('../db_remota_visualizador');
    const pool = await poolPromiseRemota;
    const result = await pool.request()
      .input('vend', sql.VarChar(50), vendedorId)
      .query(`
        WITH PuntosCliente AS (
          SELECT
            c.ID_CLIENTE,
            0 AS ID_SUCURSAL,
            CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
            NULL AS SucursalNombre,
            CAST(c.ID_VEND_1 AS VARCHAR(50)) AS Vend,
            CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
            CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON,
            CAST(c.NOMBRE_COMERCIAL AS VARCHAR(250)) AS NombreComercial
          FROM PBIT_CLIENTES_2 c
          WHERE c.ID_VEND_1 = @vend 
            OR c.ID_CLIENTE IN (3689, 6395) 
            OR c.NOMBRE_COMERCIAL LIKE '%EMPLEADO TME%'

          UNION ALL

          SELECT
            s.ID_CLIENTE,
            s.ID_SUCURSAL,
            CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
            CAST(s.NOM_SUCURSAL AS VARCHAR(250)) AS SucursalNombre,
            CAST(s.ID_VENDEDOR AS VARCHAR(50)) AS Vend,
            CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
            CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON,
            CAST(c.NOMBRE_COMERCIAL AS VARCHAR(250)) AS NombreComercial
          FROM PBIT_SUCURSALES_2 s
          INNER JOIN PBIT_CLIENTES_2 c ON s.ID_CLIENTE = c.ID_CLIENTE
          WHERE s.ID_VENDEDOR = @vend OR s.ID_CLIENTE IN (3689, 6395)
        )
        SELECT ID_CLIENTE, ID_SUCURSAL, NombreCliente, SucursalNombre, Vend, GPS_LAT, GPS_LON, NombreComercial
        FROM PuntosCliente
        WHERE GPS_LAT IS NOT NULL AND GPS_LON IS NOT NULL
      `);

    return result.recordset
      .map((row) => {
        const lat = Number(row.GPS_LAT);
        const lng = Number(row.GPS_LON);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

        const branchName = row.ID_SUCURSAL === 0 ? '' : (row.SucursalNombre ? String(row.SucursalNombre).trim() : '');
        const isEmpleado = String(row.NombreComercial || '').toUpperCase().includes('EMPLEADO TME');

        return {
          key: String(row.ID_CLIENTE).trim(),
          branchNumber: String(row.ID_SUCURSAL || 0).trim(),
          clientBranchName: branchName,
          name: String(row.NombreCliente || '').trim(),
          vendor: String(row.Vend || '').trim(),
          lat,
          lng,
          isEmpleadoTME: isEmpleado
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('[visualizador] No fue posible cargar clientes remotos:', error.message || error);
    throw new Error('REMOTE_DB_CONNECTION_ERROR');
  }
}

async function getRutasResumen(req, res) {
  const fecha = req.query.fecha ? String(req.query.fecha).trim() : null;
  const vendedor = req.query.vendedor ? String(req.query.vendedor).trim() : null;
  const limiteRaw = Number(req.query.limite || DEFAULT_LIMIT);
  const limite = Number.isNaN(limiteRaw)
    ? DEFAULT_LIMIT
    : Math.min(Math.max(limiteRaw, 1), MAX_LIMIT);

  if (!fecha) {
    return res.status(400).json({
      error: 'El parámetro fecha es obligatorio (formato YYYY-MM-DD).'
    });
  }

  try {
    const pool = await poolPromiseRutas;
    const request = pool.request()
      .input('fecha', sql.Date, fecha)
      .input('vendedor', sql.VarChar(50), vendedor)
      .input('limite', sql.Int, limite);

    const query = `
      SELECT TOP (@limite)
        rd.id_ruta_diaria,
        CAST(rd.fecha AS DATE) AS fecha,
        COALESCE(vend.id_vendedor, rd.id_vendedor) AS id_vendedor,
        vend.nombre AS nombre_vendedor,
        v.placa,
        v.descripcion AS vehiculo,
        (
          SELECT COUNT(1)
          FROM viajes vg
          WHERE vg.id_ruta_diaria = rd.id_ruta_diaria
        ) AS viajes_count
      FROM rutas_diarias rd
      INNER JOIN vehiculos v ON v.id_vehiculo = rd.id_vehiculo
      LEFT JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
      WHERE CAST(rd.fecha AS DATE) = @fecha
        AND (@vendedor IS NULL OR COALESCE(vend.id_vendedor, rd.id_vendedor) = @vendedor)
      ORDER BY rd.id_ruta_diaria DESC
    `;

    const result = await request.query(query);

    const items = result.recordset.map((row) => ({
      id_ruta: row.id_ruta_diaria,
      fecha: row.fecha instanceof Date
        ? row.fecha.toISOString().split('T')[0]
        : String(row.fecha),
      vendedor: row.id_vendedor || null,
      nombreVendedor: row.nombre_vendedor || null,
      placa: row.placa,
      vehiculo: row.vehiculo,
      viajesCount: row.viajes_count
    }));

    return res.status(200).json({
      filtros: { fecha, vendedor, limite },
      total: items.length,
      items
    });
  } catch (error) {
    console.error('[visualizador] Error obteniendo resumen de rutas:', error);
    return res.status(500).json({ error: 'Error interno al consultar rutas.' });
  }
}

async function getRutaDetalle(req, res) {
  const idRuta = Number(req.params.id_ruta);
  const includeClientes = toBool(req.query.incluirClientes, false);
  const minStopDuration = Number(req.query.minStopDuration || 5);

  if (!Number.isInteger(idRuta) || idRuta <= 0) {
    return res.status(400).json({ error: 'id_ruta debe ser un entero positivo.' });
  }

  try {
    const pool = await poolPromiseRutas;

    const resultRuta = await pool.request()
      .input('id', sql.Int, idRuta)
      .query(`
        SELECT
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
        WHERE rd.id_ruta_diaria = @id
      `);

    if (!resultRuta.recordset.length) {
      return res.status(404).json({ error: 'Ruta no encontrada.' });
    }

    const row = resultRuta.recordset[0];

    const resultViajes = await pool.request()
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

    const rawEvents = parseRawEventsJson(row.datos_ruta);

    let clientes = [];
    if (includeClientes) {
      try {
        clientes = await fetchClientesByVendedor(row.id_vendedor);
      } catch (err) {
        return res.status(503).json({
          success: false,
          errorType: "REMOTE_DB_CONNECTION_ERROR",
          message: "Falla de conexión: No se pudo cargar el catálogo de clientes. El servidor remoto no responde."
        });
      }
    }

    const processedTrip = buildProcessedTripPayload({
      row,
      viajesAnaliticos: resultViajes.recordset,
      rawEvents,
      minStopDuration,
      clientes
    });

    processedTrip.source = 'database';

    return res.status(200).json(processedTrip);
  } catch (error) {
    console.error('[visualizador] Error obteniendo detalle de ruta:', error);
    return res.status(500).json({ error: 'Error interno al obtener el detalle de ruta.' });
  }
}

async function getRutasBatch(req, res) {
  const idsRaw = req.query.ids;
  const includeClientes = toBool(req.query.incluirClientes, false);
  const minStopDuration = Number(req.query.minStopDuration || 5);

  if (!idsRaw) {
    return res.status(400).json({ error: 'El parámetro ids es obligatorio (ej. ?ids=1,2,3).' });
  }

  const ids = idsRaw.split(',').map(Number).filter(id => Number.isInteger(id) && id > 0);
  
  if (ids.length === 0) {
    return res.status(400).json({ error: 'No se enviaron IDs válidos.' });
  }

  try {
    const pool = await poolPromiseRutas;

    const resultRutas = await pool.request().query(`
      SELECT
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
      WHERE rd.id_ruta_diaria IN (${ids.join(',')})
    `);

    if (!resultRutas.recordset.length) {
      return res.status(200).json([]);
    }

    const processedTrips = [];

    for (const row of resultRutas.recordset) {
      const resultViajes = await pool.request()
        .input('id', sql.Int, row.id_ruta_diaria)
        .query(`
          SELECT hora_inicio, latitud_inicio, longitud_inicio, hora_fin, latitud_final, longitud_final 
          FROM viajes 
          WHERE id_ruta_diaria = @id 
          ORDER BY hora_inicio ASC
        `);

      const rawEvents = parseRawEventsJson(row.datos_ruta);

      let clientes = [];
      if (includeClientes && row.id_vendedor) {
        clientes = await fetchClientesByVendedor(row.id_vendedor);
      }

      const processedTrip = buildProcessedTripPayload({
        row,
        viajesAnaliticos: resultViajes.recordset,
        rawEvents,
        minStopDuration,
        clientes
      });

      processedTrip.source = 'database';
      processedTrips.push(processedTrip);
    }

    return res.status(200).json(processedTrips);
  } catch (error) {
    console.error('[visualizador batch] Error obteniendo detalle en lote:', error);
    return res.status(500).json({ error: 'Error interno al obtener el batch de rutas.' });
  }
}

module.exports = {
  getRutasResumen,
  getRutaDetalle,
  getAvailableDates,
  fetchClientesByVendedor,
  getRutasBatch
};

async function getAvailableDates(req, res) {
  try {
    const pool = await poolPromiseRutas;
    const result = await pool.request().query(`
      SELECT
        CAST(rd.fecha AS DATE) AS fecha,
        COUNT(rd.id_ruta_diaria) AS totalRutas
      FROM rutas_diarias rd
      GROUP BY CAST(rd.fecha AS DATE)
      ORDER BY CAST(rd.fecha AS DATE) DESC
    `);

    const fechas = result.recordset.map((row) => ({
      fecha: row.fecha instanceof Date
        ? row.fecha.toISOString().split('T')[0]
        : String(row.fecha),
      totalRutas: Number(row.totalRutas || 0)
    }));

    return res.status(200).json(fechas);
  } catch (error) {
    console.error('[visualizador] Error obteniendo fechas disponibles:', error);
    return res.status(500).json({ error: 'Error interno al obtener fechas.' });
  }
}