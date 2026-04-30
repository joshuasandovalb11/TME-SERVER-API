// sistema_marketing/routes/facturas.js
const express = require('express');
const router = express.Router();
const { sql, poolRemotoPromise } = require('../db_remota');

function normalizeProveedorIds(rawValue) {
  const values = Array.isArray(rawValue) ? rawValue : [rawValue];

  const parsed = values
    .flatMap((value) => String(value ?? '').split(','))
    .map((value) => value.trim())
    .filter((value) => value !== '' && value.toLowerCase() !== 'all');

  return Array.from(new Set(parsed));
}

router.get('/cliente/:idCliente', async (req, res) => {
    const { idCliente } = req.params;
    const { idSucursal, fechaInicio, fechaFin, excluirCanceladas, idProveedor } = req.query;
    const proveedorIds = normalizeProveedorIds(idProveedor);

    if (proveedorIds.length > 100) {
        return res.status(400).json({ error: 'Demasiados proveedores en el filtro.' });
    }

    const fFin = fechaFin || new Date().toISOString().split('T')[0];
    const fIni = fechaInicio || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0];
    const flagExcluirCanceladas = excluirCanceladas === 'true' ? 1 : 0;
    const numSucursal = parseInt(idSucursal) || 0;

    try {
        const pool = await poolRemotoPromise;
        const request = pool.request();

        request.input('idCliente', sql.VarChar(50), idCliente);
        request.input('idSucursal', sql.Int, numSucursal);
        request.input('fIni', sql.Date, fIni);
        request.input('fFin', sql.Date, fFin);
        request.input('flagExcluirCanceladas', sql.Int, flagExcluirCanceladas);
        proveedorIds.forEach((provId, index) => {
            request.input(`idProveedor${index}`, sql.VarChar(50), String(provId));
        });

        const proveedorWhere =
            proveedorIds.length > 0
                ? `AND CAST(a.ID_PROVEEDOR AS VARCHAR(50)) IN (${proveedorIds
                    .map((_, i) => `@idProveedor${i}`)
                    .join(', ')})`
                : '';

        const query = `
            SELECT 
                f.ID_FACTURA, 
                f.FECHA, 
                f.IMP_TOTAL, 
                f.MONEDA,
                fa.CANTIDAD, 
                fa.PRECIO,
                fa.IMP_NETO as TotalLinea,
                a.DESC_PRODUCTO,
                pr.RAZON_SOCIAL_PROV as Proveedor
            FROM PBIT_FACTURASCLIE_2 f
            INNER JOIN PBIT_FACTURASCLIE_ARTICULOS_2 fa ON f.ID_FACTURA = fa.ID_FACTURA
            INNER JOIN PBIT_ARTICULOS_2 a ON fa.ID_PRODUCTO = a.ID_PRODUCTO
            LEFT JOIN PBIT_PROVEEDORES pr ON CAST(a.ID_PROVEEDOR AS VARCHAR) = CAST(pr.ID_PROVEEDOR AS VARCHAR)
            LEFT JOIN PBIT_FACTURASCLIE_ESTATUS_2 st ON f.ID_FACTURA = st.ID_FACTURA
            WHERE f.ID_CLIENTE = @idCliente 
                AND ISNULL(f.ID_SUCURSAL, 0) = @idSucursal
                AND f.FECHA >= @fIni 
                AND f.FECHA <= @fFin
                AND (st.CANCELADA = 0 OR st.CANCELADA IS NULL OR @flagExcluirCanceladas = 0)
                ${proveedorWhere}
            ORDER BY f.FECHA DESC
        `;

        const result = await request.query(query);

        const facturasMap = new Map();

        result.recordset.forEach(row => {
            if (!facturasMap.has(row.ID_FACTURA)) {
                facturasMap.set(row.ID_FACTURA, {
                    idFactura: row.ID_FACTURA,
                    fecha: row.FECHA,
                    totalDocumento: row.IMP_TOTAL,
                    moneda: row.MONEDA,
                    articulos: [],
                    proveedoresSet: new Set()
                });
            }
            
            const currentFactura = facturasMap.get(row.ID_FACTURA);
            const provName = row.Proveedor ? row.Proveedor.trim() : 'Desconocido';
            
            currentFactura.proveedoresSet.add(provName);

            currentFactura.articulos.push({
                descripcion: row.DESC_PRODUCTO,
                cantidad: row.CANTIDAD,
                precioUnitario: row.PRECIO,
                totalLinea: row.TotalLinea,
                proveedor: provName
            });
        });

        const data = Array.from(facturasMap.values()).map(factura => {
            const uniqueProviders = Array.from(factura.proveedoresSet);
            delete factura.proveedoresSet;

            let finalTotal = factura.totalDocumento; 

            if (proveedorIds.length > 0) {
                finalTotal = factura.articulos.reduce((suma, art) => suma + art.totalLinea, 0);
            }

            return {
                ...factura,
                total: finalTotal,
                proveedoresUnicos: uniqueProviders
            };
        });

        res.json(data);

    } catch (error) {
        console.error('❌ Error obteniendo facturas del cliente:', error.message);
        res.status(500).json({ error: 'Error al obtener facturas', detalle: error.message });
    }
});

module.exports = router;