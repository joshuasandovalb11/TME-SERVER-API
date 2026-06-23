const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');
const { buildProcessedTripPayload, toBool } = require('./ruta_mapper');
const { fetchClientesByVendedor } = require('./rutas.service');

const procesarBatchTelemetry = async (deviceId, date, columns, newEvents) => {
  const pool = await poolPromiseRutas;
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Paso A: Validación de Identidad
    const resultDispositivo = await transaction.request()
      .input('deviceId', sql.VarChar(100), deviceId)
      .query(`
        SELECT id_vendedor 
        FROM dispositivos 
        WHERE id_dispositivo = @deviceId AND estatus = 1
      `);

    if (resultDispositivo.recordset.length === 0) {
      throw new Error('UNAUTHORIZED');
    }

    const idVendedor = resultDispositivo.recordset[0].id_vendedor;

    // Paso B: Resolución de Conflictos (UPSERT)
    const resultRuta = await transaction.request()
      .input('idVendedor', sql.VarChar(50), idVendedor)
      .input('fecha', sql.Date, date)
      .query(`
        SELECT id_ruta_movil, CAST(DECOMPRESS(datos_ruta) AS NVARCHAR(MAX)) AS datos_ruta 
        FROM rutas_moviles_diarias WITH (UPDLOCK, HOLDLOCK)
        WHERE id_vendedor = @idVendedor AND fecha = @fecha
      `);

    const timestampIndex = columns.indexOf('timestamp');
    if (timestampIndex === -1) {
      throw new Error('INVALID_PAYLOAD: Missing timestamp column');
    }

    if (resultRuta.recordset.length === 0) {
      // INSERT
      const uniqueEvents = new Map();
      newEvents.forEach(evt => uniqueEvents.set(evt[timestampIndex], evt));
      const sortedEvents = Array.from(uniqueEvents.values()).sort((a, b) => a[timestampIndex] - b[timestampIndex]);
      const payloadData = JSON.stringify({ columns, events: sortedEvents });

      await transaction.request()
        .input('idDispositivo', sql.VarChar(100), deviceId)
        .input('idVendedor', sql.VarChar(50), idVendedor)
        .input('fecha', sql.Date, date)
        .input('datosRuta', sql.NVarChar(sql.MAX), payloadData)
        .query(`
          INSERT INTO rutas_moviles_diarias (id_dispositivo, id_vendedor, fecha, datos_ruta, fecha_sincronizacion) 
          VALUES (@idDispositivo, @idVendedor, @fecha, COMPRESS(@datosRuta), GETDATE())
        `);
    } else {
      // UPSERT / UPDATE
      const idRutaMovil = resultRuta.recordset[0].id_ruta_movil;
      const oldPayload = JSON.parse(resultRuta.recordset[0].datos_ruta);

      if (JSON.stringify(oldPayload.columns) !== JSON.stringify(columns)) {
        throw new Error('INVALID_PAYLOAD: Schema Mismatch');
      }

      const oldEvents = oldPayload.events || [];
      const uniqueEvents = new Map();

      oldEvents.forEach(evt => uniqueEvents.set(evt[timestampIndex], evt));
      newEvents.forEach(evt => uniqueEvents.set(evt[timestampIndex], evt));

      const mergedEvents = Array.from(uniqueEvents.values()).sort((a, b) => a[timestampIndex] - b[timestampIndex]);

      const updatedPayload = JSON.stringify({ columns, events: mergedEvents });

      await transaction.request()
        .input('idRutaMovil', sql.Int, idRutaMovil)
        .input('datosRuta', sql.NVarChar(sql.MAX), updatedPayload)
        .query(`
          UPDATE rutas_moviles_diarias 
          SET datos_ruta = COMPRESS(@datosRuta), 
              fecha_sincronizacion = GETDATE() 
          WHERE id_ruta_movil = @idRutaMovil
        `);
    }

    await transaction.commit();
    return { success: true, message: 'Batch procesado exitosamente. Puede purgar la BD local.' };
  } catch (error) {
    if (transaction) {
      await transaction.rollback();
    }
    console.error('❌ Error en procesarBatchTelemetry:', error.message || error);
    throw error;
  }
};

const getRutaMovilDetalle = async (req, res) => {
  const idRutaMovil = Number(req.params.id_ruta_movil);
  const incluirClientes = toBool(req.query.incluirClientes, false);
  const minStopDuration = Number(req.query.minStopDuration || 5);

  if (!Number.isInteger(idRutaMovil) || idRutaMovil <= 0) {
    return res.status(400).json({ error: 'id_ruta_movil debe ser un entero positivo.' });
  }

  try {
    const pool = await poolPromiseRutas;
    const resultRuta = await pool.request()
      .input('id', sql.Int, idRutaMovil)
      .query(`
        SELECT 
          r.id_ruta_movil, 
          r.fecha, 
          r.id_vendedor, 
          v.nombre AS nombre_vendedor, 
          d.modelo_dispositivo, 
          CAST(DECOMPRESS(r.datos_ruta) AS NVARCHAR(MAX)) AS datos_ruta
        FROM rutas_moviles_diarias r
        LEFT JOIN vendedores v ON v.id_vendedor = r.id_vendedor
        LEFT JOIN dispositivos d ON d.id_dispositivo = r.id_dispositivo
        WHERE r.id_ruta_movil = @id
      `);

    if (resultRuta.recordset.length === 0) {
      return res.status(404).json({ error: 'Ruta móvil no encontrada.' });
    }

    const row = resultRuta.recordset[0];
    const parsedData = JSON.parse(row.datos_ruta || '{}');
    const events = parsedData.events || [];

    // Falso Excel - Adaptador
    const rawEvents = events.map(arr => {
      const [lat, lng, ts, speed, state] = arr;
      // Convertir ts a hora local de Tijuana
      const date = new Date(ts > 9999999999 ? ts : ts * 1000);
      const h = date.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/Tijuana' });
      return {
        h: h,
        lat: Number(lat),
        lng: Number(lng),
        vel: Number(speed),
        odo: 0,
        evt: Number(speed) > 0 ? 'En ruta' : 'Detenido'
      };
    });

    const rowParaMapper = {
      id_ruta_diaria: row.id_ruta_movil,
      fecha: row.fecha,
      id_vendedor: row.id_vendedor,
      nombre_vendedor: row.nombre_vendedor,
      placa: 'Móvil',
      vehiculo: row.modelo_dispositivo
    };

    let clientes = [];
    if (incluirClientes && row.id_vendedor) {
      try {
        clientes = await fetchClientesByVendedor(row.id_vendedor);
      } catch (err) {
        return res.status(503).json({
          success: false,
          errorType: "REMOTE_DB_CONNECTION_ERROR",
          message: "Falla de conexión: No se pudo cargar el catálogo de clientes."
        });
      }
    }

    const payload = buildProcessedTripPayload({
      row: rowParaMapper,
      viajesAnaliticos: [],
      rawEvents,
      minStopDuration,
      clientes
    });

    payload.source = 'mobile-device';

    return res.status(200).json(payload);
  } catch (error) {
    console.error('❌ Error en getRutaMovilDetalle:', error.message || error);
    return res.status(500).json({ error: 'Error interno del servidor procesando detalle móvil.' });
  }
};

module.exports = {
  procesarBatchTelemetry,
  getRutaMovilDetalle
};
