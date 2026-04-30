const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db');

// RUTA: GET /analisis
router.get('/analisis', async (req, res) => {
  const { fechaInicio, fechaFin, vendedor } = req.query;

  const fFin = fechaFin || new Date().toISOString().split('T')[0];
  const fIni =
    fechaInicio ||
    new Date(new Date().setDate(new Date().getDate() - 30))
      .toISOString()
      .split('T')[0];

  console.log(
    `[Marketing] Análisis solicitado: ${fIni} a ${fFin} (Vend: ${vendedor || 'Todos'})`
  );

  try {
    const pool = await poolPromise;
    const request = pool.request();

    request.input('fIni', sql.Date, fIni);
    request.input('fFin', sql.Date, fFin);

    let query = `
      SELECT 
        c.ClienteID, 
        c.SucursalID,
        MAX(c.NombreCliente) as NombreCliente,
        MAX(c.SucursalNombre) as SucursalNombre,
        MAX(c.GPS) as GPS,
        MAX(c.Vend) as Vend,
        ISNULL(SUM(p.ImporteMN), 0) as TotalMXN,
        ISNULL(SUM(p.ImporteUS), 0) as TotalUSD,
        COUNT(p.PedidoID) as NumPedidos,
        MAX(p.Fecha) as UltimaCompra
      FROM Clientes c
      LEFT JOIN Pedidos p ON c.ClienteID = p.ClienteID
                          AND ISNULL(c.SucursalID, 0) = ISNULL(p.SucursalID, 0)
                          AND p.Fecha >= @fIni
                          AND p.Fecha <= @fFin
      WHERE c.GPS IS NOT NULL AND c.GPS LIKE '%,%'
    `;

    if (vendedor) {
      query += ' AND c.Vend = @vend';
      request.input('vend', sql.VarChar(10), vendedor);
    }

    query += ' GROUP BY c.ClienteID, c.SucursalID';

    const result = await request.query(query);

    const data = result.recordset.map((row) => {
      const gpsParts = row.GPS ? row.GPS.split(',') : [0, 0];
      const lat = parseFloat(gpsParts[0]);
      const lng = parseFloat(gpsParts[1]);

      return {
        id: `${row.ClienteID}_${row.SucursalID || 0}`, 
        name: row.NombreCliente,
        branchName: row.SucursalNombre || null,
        
        lat: isNaN(lat) ? 0 : lat,
        lng: isNaN(lng) ? 0 : lng,
        vendor: row.Vend,
        marketingData: {
          clienteId: row.ClienteID,
          totalSpentMXN: row.TotalMXN,
          totalSpentUSD: row.TotalUSD,
          ordersCount: row.NumPedidos,
          lastPurchase: row.UltimaCompra,
          status: row.NumPedidos > 0 ? 'activo' : 'sin_compra',
        },
      };
    });

    res.json(data);
  } catch (error) {
    console.error('❌ Error en Módulo Marketing:', error.message);
    res.status(500).json({ error: 'Error al procesar análisis de marketing' });
  }
});

module.exports = router;