const { sql, poolRemotoBuscarClientesPromise } = require('../db_remota_buscar_clientes');

async function buscarClienteApp(clienteId) {
  const pool = await poolRemotoBuscarClientesPromise;
  const request = pool.request();
  request.input('clienteId', sql.Int, clienteId);

  const result = await request.query(`
    WITH PuntosCliente AS (
      SELECT
        c.ID_CLIENTE,
        0 AS ID_SUCURSAL,
        CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
        CAST('MATRIZ' AS VARCHAR(250)) AS SucursalNombre,
        CAST(c.ID_VEND_1 AS VARCHAR(50)) AS Vend,
        CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
        CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON,
        CAST(v.NOM_VENDEDOR AS VARCHAR(250)) AS VendedorNombre,
        CAST(COALESCE(NULLIF(v.TELEFONO_1, ''), NULLIF(v.CELULAR_1, ''), NULLIF(v.TELEFONO_2, '')) AS VARCHAR(50)) AS VendedorTelefono
      FROM PBIT_CLIENTES_2 c
      LEFT JOIN PBIT_VENDEDORES v
        ON LTRIM(RTRIM(c.ID_VEND_1)) = LTRIM(RTRIM(v.ID_VENDEDOR))
      WHERE c.ID_CLIENTE = @clienteId

      UNION ALL

      SELECT
        s.ID_CLIENTE,
        s.ID_SUCURSAL,
        CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
        CAST(s.NOM_SUCURSAL AS VARCHAR(250)) AS SucursalNombre,
        CAST(s.ID_VENDEDOR AS VARCHAR(50)) AS Vend,
        CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
        CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON,
        CAST(v.NOM_VENDEDOR AS VARCHAR(250)) AS VendedorNombre,
        CAST(COALESCE(NULLIF(v.TELEFONO_1, ''), NULLIF(v.CELULAR_1, ''), NULLIF(v.TELEFONO_2, '')) AS VARCHAR(50)) AS VendedorTelefono
      FROM PBIT_SUCURSALES_2 s
      INNER JOIN PBIT_CLIENTES_2 c
        ON s.ID_CLIENTE = c.ID_CLIENTE
      LEFT JOIN PBIT_VENDEDORES v
        ON LTRIM(RTRIM(s.ID_VENDEDOR)) = LTRIM(RTRIM(v.ID_VENDEDOR))
      WHERE s.ID_CLIENTE = @clienteId
    )
    SELECT
      ID_CLIENTE AS ClienteID,
      NombreCliente,
      ID_SUCURSAL AS SucursalID,
      SucursalNombre,
      Vend,
      VendedorNombre,
      VendedorTelefono,
      GPS_LAT,
      GPS_LON
    FROM PuntosCliente
    ORDER BY ID_SUCURSAL ASC
  `);

  return result.recordset.map((row) => {
    const lat = parseFloat(row.GPS_LAT);
    const lng = parseFloat(row.GPS_LON);

    let latitud = null;
    let longitud = null;

    if (!Number.isNaN(lat) && !Number.isNaN(lng) && (lat !== 0 || lng !== 0)) {
      latitud = lat;
      longitud = lng;
    }

    return {
      id: String(row.ClienteID).trim(),
      idCliente: row.ClienteID,
      idSucursal: row.SucursalID,
      nombre: (row.NombreCliente || 'N/A').trim(),
      latitud: latitud,
      longitud: longitud,
      numeroSucursal: row.SucursalID ? String(row.SucursalID).trim() : '0',
      nombreSucursal: (row.SucursalNombre || '').trim(),
      vendedorCodigo: (row.Vend || '').trim(),
      vendedorNombre: (row.VendedorNombre || 'No asignado').trim(),
      vendedorTelefono: (row.VendedorTelefono || '').trim(),
    };
  });
}

async function obtenerVendedores() {
  const pool = await poolRemotoBuscarClientesPromise;
  const result = await pool.request().query(`
    SELECT ID_VENDEDOR as Vend
    FROM PBIT_VENDEDORES
    WHERE (INACTIVO = 0 OR INACTIVO IS NULL)
      AND TIPO = 'E'
    ORDER BY NOM_VENDEDOR ASC
  `);

  return result.recordset.map((row) => row.Vend);
}

async function buscarClientesPorVendedor(vendedorSeleccionado) {
  const pool = await poolRemotoBuscarClientesPromise;
  const request = pool.request();
  request.input('vend', sql.VarChar, vendedorSeleccionado);

  const result = await request.query(`
    WITH PuntosCliente AS (
      SELECT
        c.ID_CLIENTE,
        0 AS ID_SUCURSAL,
        CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
        CAST('MATRIZ' AS VARCHAR(250)) AS SucursalNombre,
        CAST(c.ID_VEND_1 AS VARCHAR(50)) AS Vend,
        CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
        CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON
      FROM PBIT_CLIENTES_2 c
      WHERE LTRIM(RTRIM(c.ID_VEND_1)) = LTRIM(RTRIM(@vend))

      UNION ALL

      SELECT
        s.ID_CLIENTE,
        s.ID_SUCURSAL,
        CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente,
        CAST(s.NOM_SUCURSAL AS VARCHAR(250)) AS SucursalNombre,
        CAST(s.ID_VENDEDOR AS VARCHAR(50)) AS Vend,
        CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT,
        CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON
      FROM PBIT_SUCURSALES_2 s
      INNER JOIN PBIT_CLIENTES_2 c
        ON s.ID_CLIENTE = c.ID_CLIENTE
      WHERE LTRIM(RTRIM(s.ID_VENDEDOR)) = LTRIM(RTRIM(@vend))
    )
    SELECT
      ID_CLIENTE AS ClienteID,
      NombreCliente,
      ID_SUCURSAL AS SucursalID,
      SucursalNombre,
      Vend,
      GPS_LAT,
      GPS_LON
    FROM PuntosCliente
  `);

  return result.recordset
    .map((row) => {
      const lat = parseFloat(row.GPS_LAT);
      const lng = parseFloat(row.GPS_LON);

      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        return null;
      }

      return {
        id: String(row.ClienteID).trim(),
        idCliente: row.ClienteID,
        idSucursal: row.SucursalID,
        nombre: (row.NombreCliente || '').trim(),
        latitud: lat,
        longitud: lng,
        numeroSucursal: row.SucursalID ? String(row.SucursalID).trim() : '0',
        nombreSucursal: row.SucursalNombre ? row.SucursalNombre.trim() : '',
      };
    })
    .filter((cliente) => cliente && cliente.latitud !== 0 && cliente.longitud !== 0);
}

module.exports = {
  buscarClienteApp,
  obtenerVendedores,
  buscarClientesPorVendedor,
};