// visualizador_rutas/services/excel.service.js
const fs = require('fs').promises;
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');
const { procesarArchivoRuta } = require('../../sistema_rutas/utils/parser');
const {
  parseRawEventsJson,
  buildProcessedTripPayload
} = require('./ruta_mapper');

/**
 * Procesa un archivo Excel cargado y devuelve la estructura v1 limpia
 * (sin guardarlo en BD, solo para visualización)
 */
async function getRutaFromExcel(req, res) {
  const minStopDuration = req.query.minStopDuration ? Number(req.query.minStopDuration) : 5;
  const incluirClientes = req.query.incluirClientes ? req.query.incluirClientes === 'true' : true;

  if (!req.file) {
    return res.status(400).json({
      error: 'No se proporcionó ningún archivo Excel.'
    });
  }

  const filePath = req.file.path;

  try {
    const datosProcesados = await procesarArchivoRuta(filePath);
    const { placa, fecha, datosRutaJSON, viajesAnaliticos } = datosProcesados;
    const pool = await poolPromiseRutas;
    const resultVehiculo = await pool.request()
      .input('placa', sql.NVarChar(20), placa)
      .query(`
        SELECT 
          v.id_vehiculo,
          v.id_vendedor,
          v.descripcion AS vehiculo,
          v.placa,
          COALESCE(vend.nombre, v.id_vendedor) AS nombre_vendedor
        FROM vehiculos v
        LEFT JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
        WHERE v.placa = @placa
      `);

    if (resultVehiculo.recordset.length === 0) {
      return res.status(404).json({
        error: `El vehículo con placa ${placa} no está registrado en el sistema.`
      });
    }

    const vehiculoRow = resultVehiculo.recordset[0];
    const rawEvents = parseRawEventsJson(datosRutaJSON);

    let clientes = [];
    if (incluirClientes && vehiculoRow.id_vendedor) {
      clientes = await fetchClientesByVendedor(vehiculoRow.id_vendedor);
    }

    const rowParaMapper = {
      id_ruta_diaria: null,
      fecha,
      id_vendedor: vehiculoRow.id_vendedor,
      nombre_vendedor: vehiculoRow.nombre_vendedor,
      placa: vehiculoRow.placa,
      vehiculo: vehiculoRow.vehiculo
    };

    const processedTrip = buildProcessedTripPayload({
      row: rowParaMapper,
      viajesAnaliticos,
      rawEvents,
      minStopDuration,
      clientes
    });

    processedTrip.source = 'excel-file';

    return res.status(200).json(processedTrip);

  } catch (error) {
    console.error('[visualizador] Error procesando Excel:', error.message || error);
    return res.status(500).json({
      error: error.message || 'Error interno al procesar el archivo Excel.'
    });
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      console.error(`[visualizador] ¡Fallo crítico! No se pudo eliminar el archivo temporal ${filePath}:`, unlinkError);
    }
  }
}

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
    return [];
  }
}

module.exports = {
  getRutaFromExcel
};
