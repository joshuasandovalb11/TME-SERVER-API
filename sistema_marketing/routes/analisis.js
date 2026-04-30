// sistema_marketing/routes/analisis.js
const express = require('express');
const router = express.Router();
const { sql, poolRemotoPromise } = require('../db_remota');
const { poolRutasMarketing } = require('../db_rutas_marketing');

function getDistanceMeters(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        0.5 - Math.cos(dLat)/2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        (1 - Math.cos(dLon))/2;
    return R * 2 * Math.asin(Math.sqrt(a));
}

function normalizeProveedorIds(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const parsed = values
    .flatMap((value) => String(value ?? '').split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '' && value.toLowerCase() !== 'all');
  return Array.from(new Set(parsed));
}

function normalizeGrupoIds(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  const parsed = values
    .flatMap((value) => String(value ?? '').split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '' && value.toLowerCase() !== 'all' && !isNaN(parseInt(value)));
  return Array.from(new Set(parsed));
}

router.get('/', async (req, res) => {
  const { 
    fechaInicio, fechaFin, vendedor, idZona, idMarca, 
    idProveedor, idProducto, excluirCanceladas, agruparSucursales, 
    convertirAMXN, soloConVentas, idCliente, idSucursal,
    idGrupoEmpresarial
  } = req.query;
  
  const proveedorIds = normalizeProveedorIds(idProveedor);
  const grupoIds = normalizeGrupoIds(idGrupoEmpresarial);

  if (proveedorIds.length > 100) {
    return res.status(400).json({ error: 'Demasiados proveedores en el filtro.' });
  }

  const fFin = fechaFin || new Date().toISOString().split('T')[0];
  const fIni = fechaInicio || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
  const flagExcluirCanceladas = excluirCanceladas === 'true' ? 1 : 0;
  const flagAgruparSucursales = agruparSucursales === 'true';
  const flagConvertirAMXN = convertirAMXN === 'true';
  const flagSoloConVentas = soloConVentas === 'true';
  const requiereFiltroDetalle =
    Boolean(idMarca) || proveedorIds.length > 0 || Boolean(idProducto);

  try {
    let viajesGPS = [];
    try {
        const poolRutas = await poolRutasMarketing;
        const rutasReq = poolRutas.request();
        rutasReq.input('fIni', sql.Date, fIni);
        rutasReq.input('fFin', sql.Date, fFin);
        
        const rutasQuery = `
            SELECT 
                vi.latitud_final, 
                vi.longitud_final,
                CONVERT(VARCHAR(10), rd.fecha, 120) as fecha_ruta
            FROM rutas_diarias rd
            INNER JOIN viajes vi ON rd.id_ruta_diaria = vi.id_ruta_diaria
            WHERE rd.fecha >= @fIni AND rd.fecha <= @fFin
        `;
        const resRutas = await rutasReq.query(rutasQuery);
        viajesGPS = resRutas.recordset;
    } catch (err) {
        console.error('❌ Error obteniendo viajes para cruce geoespacial:', err.message);
    }

    const pool = await poolRemotoPromise;
    const request = pool.request();

    request.input('fIni', sql.Date, fIni);
    request.input('fFin', sql.Date, fFin);
    request.input('flagExcluirCanceladas', sql.Int, flagExcluirCanceladas);
    if (vendedor) request.input('vendedor', sql.VarChar(50), vendedor);
    if (idZona) request.input('idZona', sql.Int, idZona);
    if (idCliente) request.input('idCliente', sql.VarChar(50), idCliente);
    if (idSucursal !== undefined) request.input('idSucursal', sql.Int, parseInt(idSucursal));
    if (idMarca) request.input('idMarca', sql.Int, idMarca);
    if (idProducto) request.input('idProducto', sql.Int, idProducto);
    
    proveedorIds.forEach((provId, index) => {
        request.input(`idProveedor${index}`, sql.VarChar(50), String(provId));
    });

    grupoIds.forEach((grupoId, index) => {
        request.input(`idGrupo${index}`, sql.Int, parseInt(grupoId));
    });

    let includeMatriz = true;
    let includeSucursales = !flagAgruparSucursales;

    if (idCliente && idSucursal !== undefined) {
        const numSucursal = parseInt(idSucursal);
        if (numSucursal === 0) {
            includeSucursales = false;
        } else {
            includeMatriz = false;
        }
    }

    let query = `WITH PuntosMapa AS ( `;
    let hasPrevious = false;

    if (includeMatriz) {
        query += `
            SELECT c.ID_CLIENTE, 0 AS ID_SUCURSAL, CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente, CAST(NULL AS VARCHAR(250)) AS SucursalNombre, CAST(c.ID_VEND_1 AS VARCHAR(50)) AS Vend, c.ID_ZONA_1 AS Zona, CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT, CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON,
            CAST(g.DESC_GIRO_COMERCIAL AS VARCHAR(250)) as GiroComercial
            FROM PBIT_CLIENTES_2 c 
            LEFT JOIN PBIT_GIROS_COMERCIALES g ON c.ID_GIRO_COMERCIAL = g.ID_GIRO_COMERCIAL
            WHERE c.GPS_LAT IS NOT NULL AND c.GPS_LAT <> ''
        `;
        if (vendedor) query += ` AND c.ID_VEND_1 = @vendedor `;
        if (idZona) query += ` AND c.ID_ZONA_1 = @idZona `;
        if (idCliente) query += ` AND c.ID_CLIENTE = @idCliente `; 
        
        if (grupoIds.length > 0) {
            query += ` AND c.ID_GRUPO_EMPRESARIAL IN (${grupoIds.map((_, i) => `@idGrupo${i}`).join(', ')}) `;
        }
        
        hasPrevious = true;
    }

    if (includeSucursales) {
        if (hasPrevious) query += ` UNION ALL `;
        query += `
            SELECT s.ID_CLIENTE, s.ID_SUCURSAL, CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente, CAST(s.NOM_SUCURSAL AS VARCHAR(250)) AS SucursalNombre, CAST(s.ID_VENDEDOR AS VARCHAR(50)) AS Vend, c.ID_ZONA_1 AS Zona, CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT, CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON,
            CAST(g.DESC_GIRO_COMERCIAL AS VARCHAR(250)) as GiroComercial
            FROM PBIT_SUCURSALES_2 s 
            INNER JOIN PBIT_CLIENTES_2 c ON s.ID_CLIENTE = c.ID_CLIENTE 
            LEFT JOIN PBIT_GIROS_COMERCIALES g ON c.ID_GIRO_COMERCIAL = g.ID_GIRO_COMERCIAL
            WHERE s.GPS_LAT IS NOT NULL AND s.GPS_LAT <> '' 
        `;
        if (vendedor) query += ` AND s.ID_VENDEDOR = @vendedor `;
        if (idZona) query += ` AND c.ID_ZONA_1 = @idZona `;
        if (idCliente) query += ` AND s.ID_CLIENTE = @idCliente `;
        if (idSucursal !== undefined && parseInt(idSucursal) !== 0) query += ` AND s.ID_SUCURSAL = @idSucursal `;
        
        if (grupoIds.length > 0) {
            query += ` AND c.ID_GRUPO_EMPRESARIAL IN (${grupoIds.map((_, i) => `@idGrupo${i}`).join(', ')}) `;
        }
    }
    query += ` ) `;

    query += ` SELECT pm.ID_CLIENTE, pm.ID_SUCURSAL, MAX(pm.NombreCliente) as NombreCliente, MAX(pm.SucursalNombre) as SucursalNombre, MAX(pm.GPS_LAT) as GPS_LAT, MAX(pm.GPS_LON) as GPS_LON, MAX(pm.Vend) as Vend, MAX(pm.GiroComercial) as GiroComercial, `;

    if (requiereFiltroDetalle) {
        if (flagConvertirAMXN) {
            query += ` ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f.MONEDA LIKE 'M%' THEN f_art.TotalDetalle ELSE f_art.TotalDetalle * ISNULL(f.TIPO_CAMBIO, 1) END), 0) as TotalMXN, 0 as TotalUSD, `;
        } else {
            query += ` ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f.MONEDA LIKE 'M%' THEN f_art.TotalDetalle ELSE 0 END), 0) as TotalMXN, ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f.MONEDA LIKE 'D%' OR f.MONEDA LIKE 'U%' THEN f_art.TotalDetalle ELSE 0 END), 0) as TotalUSD, `;
        }
        query += `ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f_art.TotalDetalle > 0 THEN 1 ELSE 0 END), 0) as NumFacturas,`;
    } else {
        if (flagConvertirAMXN) {
            query += ` ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 ELSE (f.IMP_TOTAL_MN - ISNULL(f.IMP_DEVOLUCION_MN, 0)) END), 0) as TotalMXN, 0 as TotalUSD, `;
        } else {
            query += ` ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f.MONEDA LIKE 'M%' THEN (f.IMP_TOTAL - ISNULL(f.IMP_DEVOLUCION, 0)) ELSE 0 END), 0) as TotalMXN, ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f.MONEDA LIKE 'D%' OR f.MONEDA LIKE 'U%' THEN (f.IMP_TOTAL - ISNULL(f.IMP_DEVOLUCION, 0)) ELSE 0 END), 0) as TotalUSD, `;
        }
        query += `ISNULL(SUM(CASE WHEN st.CANCELADA = 1 AND @flagExcluirCanceladas = 1 THEN 0 WHEN f.ID_FACTURA IS NOT NULL THEN 1 ELSE 0 END), 0) as NumFacturas,`;
    }

    query += ` MAX(f.FECHA) as UltimaCompra FROM PuntosMapa pm `;

    if (!flagAgruparSucursales) {
        query += ` LEFT JOIN PBIT_FACTURASCLIE_2 f ON pm.ID_CLIENTE = f.ID_CLIENTE AND pm.ID_SUCURSAL = ISNULL(f.ID_SUCURSAL, 0) AND f.FECHA >= @fIni AND f.FECHA <= @fFin `;
    } else {
        query += ` LEFT JOIN PBIT_FACTURASCLIE_2 f ON pm.ID_CLIENTE = f.ID_CLIENTE AND f.FECHA >= @fIni AND f.FECHA <= @fFin `;
    }
    query += ` LEFT JOIN PBIT_FACTURASCLIE_ESTATUS_2 st ON f.ID_FACTURA = st.ID_FACTURA `;

    if (requiereFiltroDetalle) {
        query += `
        LEFT JOIN (
            SELECT fa.ID_FACTURA, SUM(fa.IMP_NETO) as TotalDetalle
            FROM PBIT_FACTURASCLIE_ARTICULOS_2 fa
            INNER JOIN PBIT_ARTICULOS_2 a ON fa.ID_PRODUCTO = a.ID_PRODUCTO
            INNER JOIN PBIT_FACTURASCLIE_2 f_inner ON f_inner.ID_FACTURA = fa.ID_FACTURA
            WHERE f_inner.FECHA >= @fIni AND f_inner.FECHA <= @fFin
        `;
        if (idMarca) query += ` AND a.ID_MARCA = @idMarca `;
        
        if (proveedorIds.length > 0) {
            query += ` AND CAST(a.ID_PROVEEDOR AS VARCHAR(50)) IN (${proveedorIds
                .map((_, i) => `@idProveedor${i}`)
                .join(', ')}) `;
        }
        
        if (idProducto) query += ` AND a.ID_PRODUCTO = @idProducto `;
        query += ` GROUP BY fa.ID_FACTURA ) f_art ON f.ID_FACTURA = f_art.ID_FACTURA `;
    }

    query += ` GROUP BY pm.ID_CLIENTE, pm.ID_SUCURSAL `;

    const result = await request.query(query);

    const clientsGrouped = new Map();
    result.recordset.forEach(row => {
        clientsGrouped.set(row.ID_CLIENTE, (clientsGrouped.get(row.ID_CLIENTE) || 0) + 1);
    });

    let data = result.recordset.map((row) => {
      const lat = parseFloat(row.GPS_LAT);
      const lng = parseFloat(row.GPS_LON);
      const hasMultiple = clientsGrouped.get(row.ID_CLIENTE) > 1;
      
      let bName = (row.SucursalNombre || '').trim();
      const isMatriz = bName === '' || bName.toLowerCase() === 'matriz';
      
      if (isMatriz) {
          bName = hasMultiple ? 'Matriz' : '';
      }

      let fechasVisitas = [];
      for (const viaje of viajesGPS) {
          if (getDistanceMeters(lat, lng, parseFloat(viaje.latitud_final), parseFloat(viaje.longitud_final)) <= 60) {
              fechasVisitas.push(viaje.fecha_ruta);
          }
      }
      
      const fechasUnicas = [...new Set(fechasVisitas)].sort();
      const fueVisitado = fechasUnicas.length > 0;

      const statusVenta = row.NumFacturas > 0 ? 'activo' : 'sin_compra';
      const ventaEnCampo = fueVisitado && statusVenta === 'activo';

      return {
        id: `${row.ID_CLIENTE}_${row.ID_SUCURSAL}`, 
        name: row.NombreCliente,
        branchName: bName,
        lat: isNaN(lat) ? 0 : lat,
        lng: isNaN(lng) ? 0 : lng,
        vendor: row.Vend,
        idSucursal: row.ID_SUCURSAL, 
        giroComercial: row.GiroComercial || null,
        marketingData: {
          clienteId: row.ID_CLIENTE,
          status: statusVenta, 
          totalSpentMXN: row.TotalMXN,
          totalSpentUSD: row.TotalUSD,
          ordersCount: row.NumFacturas, 
          lastPurchase: row.UltimaCompra,
          visitadoEnPeriodo: fueVisitado,
          fechasVisitas: fechasUnicas,
          ventaEnCampo: ventaEnCampo
        },
      };
    });

    if (flagSoloConVentas) {
        data = data.filter(cliente => cliente.marketingData.ordersCount > 0);
    }

    res.json(data);
  } catch (error) {
    console.error('❌ Error en Motor de Análisis:', error.message);
    res.status(500).json({ error: 'Error al procesar', detalle: error.message });
  }
});

module.exports = router;