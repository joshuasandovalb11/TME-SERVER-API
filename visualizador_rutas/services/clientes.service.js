// visualizador_rutas/services/clientes.service.js
const { sql, poolPromiseRemota } = require('../db_remota_visualizador');

function getInitials(name) {
  if (!name) return undefined;
  return name.split(/\s+/).map(p => p[0]).join('').substring(0,3).toUpperCase();
}

async function getClientes(req, res) {
  try {
    const pool = await poolPromiseRemota;
    const result = await pool.request().query(`
      WITH PuntosCliente AS (
        SELECT
          c.ID_CLIENTE,
          0 AS ID_SUCURSAL,
          CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
          CAST('MATRIZ' AS VARCHAR(250)) AS SucursalNombre,
          CAST(c.ID_VEND_1 AS VARCHAR(50)) AS Vend,
          CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
          CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON,
          CAST(ci.NOM_CIUDAD AS VARCHAR(250)) AS Ciudad,
          CAST(c.NOMBRE_COMERCIAL AS VARCHAR(250)) AS NombreComercial
        FROM PBIT_CLIENTES_2 c
        LEFT JOIN PBIT_CLIENTES_DIR_2 d
          ON d.ID_CLIENTE = c.ID_CLIENTE
        LEFT JOIN PBIT_CIUDADES ci
          ON ci.ID_CIUDAD = COALESCE(d.ENTREGA_ID_CIUDAD, d.ID_CIUDAD)

        UNION ALL

        SELECT
          s.ID_CLIENTE,
          s.ID_SUCURSAL,
          CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
          CAST(s.NOM_SUCURSAL AS VARCHAR(250)) AS SucursalNombre,
          CAST(s.ID_VENDEDOR AS VARCHAR(50)) AS Vend,
          CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
          CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON,
          CAST(ci.NOM_CIUDAD AS VARCHAR(250)) AS Ciudad,
          CAST(c.NOMBRE_COMERCIAL AS VARCHAR(250)) AS NombreComercial
        FROM PBIT_SUCURSALES_2 s
        INNER JOIN PBIT_CLIENTES_2 c
          ON s.ID_CLIENTE = c.ID_CLIENTE
        LEFT JOIN PBIT_CIUDADES ci
          ON ci.ID_CIUDAD = s.ID_CIUDAD
      )
      SELECT
        ID_CLIENTE AS ClienteID,
        NombreCliente,
        ID_SUCURSAL AS SucursalID,
        SucursalNombre,
        Vend,
        GPS_LAT,
        GPS_LON,
        Ciudad,
        NombreComercial
      FROM PuntosCliente
      WHERE GPS_LAT IS NOT NULL AND GPS_LON IS NOT NULL
    `);

    const clientesProcesados = result.recordset.map(row => {
      const lat = parseFloat(row.GPS_LAT);
      const lng = parseFloat(row.GPS_LON);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }

      const isVendorHome = row.NombreComercial && row.NombreComercial.toUpperCase().trim() === 'EMPLEADO TME';

      let vendorHomeInitial = undefined;
      if (isVendorHome && row.NombreCliente) {
        const cleanName = row.NombreCliente.toUpperCase().trim().replace(/\s+/g, ' ');
        vendorHomeInitial = getInitials(cleanName);
      }

      return {
        key: String(row.ClienteID).trim(),
        name: (row.NombreCliente || '').trim(),
        lat: lat,
        lng: lng,
        vendor: (row.Vend || '').trim(),
        branchNumber: row.SucursalID ? String(row.SucursalID).trim() : undefined,
        branchName: row.SucursalNombre ? row.SucursalNombre.trim() : undefined,
        city: row.Ciudad ? row.Ciudad.trim() : undefined,
        displayName: (row.NombreCliente || '').trim(),
        isVendorHome: isVendorHome,
        vendorHomeInitial: vendorHomeInitial
      };
    }).filter(c => c && c.lat !== 0 && c.lng !== 0);

    res.status(200).json(clientesProcesados);
  } catch (error) {
    console.error('visualizador_rutas.getClientes error:', error.message || error);
    res.status(500).json({ message: 'Error interno SQL (PBI)' });
  }
}

async function obtenerVendedores() {
  const pool = await poolPromiseRemota;
  const result = await pool.request().query(`
    SELECT ID_VENDEDOR as Vend
    FROM PBIT_VENDEDORES
    WHERE (INACTIVO = 0 OR INACTIVO IS NULL)
      AND TIPO = 'E'
    ORDER BY NOM_VENDEDOR ASC
  `);

  return result.recordset.map((row) => row.Vend);
}

module.exports = { getClientes, obtenerVendedores };
