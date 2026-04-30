// sistema_marketing/routes/clientes.js
const express = require('express');
const router = express.Router();
const { sql, poolRemotoPromise } = require('../db_remota');

// ==========================================
// 1. BUSCADOR INTELIGENTE DE CLIENTES
// ==========================================
router.get('/buscar', async (req, res) => {
    const { q } = req.query; 

    if (!q || q.trim().length < 2) {
        return res.json([]); 
    }

    try {
        const pool = await poolRemotoPromise;
        const request = pool.request();
        
        const termino = q.trim();
        const esNumeroExacto = /^\d+$/.test(termino); 

        let query = `
            WITH PuntosBuscables AS (
                SELECT 
                    c.ID_CLIENTE, 0 AS ID_SUCURSAL, CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente, 
                    CAST('MATRIZ' AS VARCHAR(250)) AS SucursalNombre, CAST(c.RFC AS VARCHAR(50)) AS RFC,
                    CAST(c.GPS_LAT AS VARCHAR(50)) AS GPS_LAT, CAST(c.GPS_LON AS VARCHAR(50)) AS GPS_LON
                FROM PBIT_CLIENTES_2 c
                WHERE c.GPS_LAT IS NOT NULL AND LTRIM(RTRIM(c.GPS_LAT)) <> '' AND c.GPS_LON IS NOT NULL AND LTRIM(RTRIM(c.GPS_LON)) <> ''

                UNION ALL

                SELECT 
                    s.ID_CLIENTE, s.ID_SUCURSAL, CAST(c.RAZON AS VARCHAR(250)) AS NombreCliente, 
                    CAST(s.NOM_SUCURSAL AS VARCHAR(250)) AS SucursalNombre, CAST(c.RFC AS VARCHAR(50)) AS RFC,
                    CAST(s.GPS_LAT AS VARCHAR(50)) AS GPS_LAT, CAST(s.GPS_LON AS VARCHAR(50)) AS GPS_LON
                FROM PBIT_SUCURSALES_2 s
                INNER JOIN PBIT_CLIENTES_2 c ON s.ID_CLIENTE = c.ID_CLIENTE
                WHERE s.GPS_LAT IS NOT NULL AND LTRIM(RTRIM(s.GPS_LAT)) <> '' AND s.GPS_LON IS NOT NULL AND LTRIM(RTRIM(s.GPS_LON)) <> ''
            )
            SELECT TOP 30
                ID_CLIENTE as idCliente, ID_SUCURSAL as idSucursal, NombreCliente as nombre,
                SucursalNombre as sucursal, RFC as rfc, GPS_LAT as lat, GPS_LON as lng
            FROM PuntosBuscables
        `;

        if (esNumeroExacto) {
            query += ` WHERE ID_CLIENTE = @numeroExacto `;
            request.input('numeroExacto', sql.Int, parseInt(termino));
        } else {
            query += ` WHERE NombreCliente LIKE @busqueda OR RFC LIKE @busqueda `;
            request.input('busqueda', sql.VarChar, `%${termino}%`);
        }

        query += ` ORDER BY NombreCliente ASC, ID_SUCURSAL ASC `;

        const result = await request.query(query);

        const uniqueMap = new Map();
        result.recordset.forEach(row => {
            let normBranch = (row.sucursal || '').trim().toUpperCase();
            if (normBranch === '' || normBranch === 'N/A') normBranch = 'MATRIZ';

            const key = `${row.idCliente}_${normBranch}`;
            
            if (!uniqueMap.has(key)) {
                uniqueMap.set(key, row);
            } else {
                if (row.idSucursal !== 0) {
                    uniqueMap.set(key, row);
                }
            }
        });

        const deduplicated = Array.from(uniqueMap.values());

        const data = deduplicated.map(row => {
            const lat = parseFloat(row.lat);
            const lng = parseFloat(row.lng);
            
            let displayBranch = (row.sucursal || '').trim();
            if (displayBranch.toUpperCase() === 'MATRIZ' || displayBranch === '') {
                displayBranch = 'Matriz';
            }

            return {
                id: `${row.idCliente}_${row.idSucursal}`, 
                idCliente: row.idCliente,
                idSucursal: row.idSucursal,
                nombre: row.nombre,
                sucursal: displayBranch,
                lat: isNaN(lat) ? 0 : lat,
                lng: isNaN(lng) ? 0 : lng
            };
        });

        res.json(data);
    } catch (error) {
        console.error('❌ Error en búsqueda de clientes:', error.message);
        res.status(500).json({ error: 'Error al buscar clientes', detalle: error.message });
    }
});

// ==========================================
// 2. OBTENER DETALLE COMPLETO DEL CLIENTE
// ==========================================
router.get('/detalle/:idCliente', async (req, res) => {
    const { idCliente } = req.params;
    const { idSucursal } = req.query;

    const sucursalNum = parseInt(idSucursal) || 0;

    try {
        const pool = await poolRemotoPromise;
        const request = pool.request();
        
        request.input('idCliente', sql.Int, idCliente);

        let query = '';

        if (sucursalNum === 0) {
            query = `
                SELECT 
                    c.ID_CLIENTE as idCliente,
                    0 as idSucursal,
                    c.RAZON as nombre,
                    c.RFC as rfc,
                    c.LIMITE_CREDITO as limiteCredito,
                    c.CONDICIONES_VENTA as condiciones,
                    c.DIAS_CREDITO as diasCredito,
                    c.ID_VEND_1 as vendedorAsignado,
                    d.CALLE as calle,
                    d.NUM_EXT as numExt,
                    d.TEL_OFICINA as telefono,
                    d.CELULAR_1 as celular,
                    d.EMAIL_1 as correo
                FROM PBIT_CLIENTES_2 c
                LEFT JOIN PBIT_CLIENTES_DIR_2 d ON c.ID_CLIENTE = d.ID_CLIENTE
                WHERE c.ID_CLIENTE = @idCliente
            `;
        } 
        else {
            query = `
                SELECT 
                    s.ID_CLIENTE as idCliente,
                    s.ID_SUCURSAL as idSucursal,
                    c.RAZON as nombre,
                    s.NOM_SUCURSAL as sucursalNombre,
                    c.RFC as rfc,
                    c.LIMITE_CREDITO as limiteCredito,
                    c.CONDICIONES_VENTA as condiciones,
                    s.ID_VENDEDOR as vendedorAsignado,
                    s.CALLE as calle,
                    s.NUM_EXT as numExt,
                    NULL as telefono, -- Las sucursales no tienen teléfono en esta tabla según el esquema
                    NULL as celular,
                    NULL as correo
                FROM PBIT_SUCURSALES_2 s
                INNER JOIN PBIT_CLIENTES_2 c ON s.ID_CLIENTE = c.ID_CLIENTE
                WHERE s.ID_CLIENTE = @idCliente AND s.ID_SUCURSAL = @idSucursal
            `;
            request.input('idSucursal', sql.Int, sucursalNum);
        }

        const result = await request.query(query);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Cliente o sucursal no encontrada' });
        }

        res.json(result.recordset[0]);
    } catch (error) {
        console.error('❌ Error obteniendo detalles del cliente:', error.message);
        res.status(500).json({ error: 'Error al obtener detalles del cliente', detalle: error.message });
    }
});

module.exports = router;