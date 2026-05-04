// sistema_marketing/routes/registros.js
const express = require('express');
const router = express.Router();
const { sql, poolPromiseRutas } = require('../db_rutas');

// 1. RUTA: Obtener solo las fechas que tienen rutas
router.get('/fechas-disponibles', async (req, res) => {
    try {
        const pool = await poolPromiseRutas;
        const result = await pool.request().query(`
            SELECT DISTINCT CAST(fecha AS DATE) AS fecha 
            FROM rutas_diarias 
            ORDER BY fecha DESC
        `);
        
        const fechas = result.recordset.map(r => r.fecha.toISOString().split('T')[0]);
        res.status(200).json(fechas);
    } catch (error) {
        console.error("Error obteniendo fechas:", error);
        res.status(500).json({ error: "Error interno al obtener las fechas." });
    }
});

// 2. RUTA PRINCIPAL: Historial de Registros
router.get('/', async (req, res) => {
    try {
        const { fechaInicio, fechaFin } = req.query;
        const limite = req.query.limite ? parseInt(req.query.limite) : 300;
        
        const pool = await poolPromiseRutas;
        let request = pool.request();

        let query = `
            SELECT ${(!fechaInicio && !fechaFin) ? `TOP (${limite})` : ''}
                rd.id_ruta_diaria,
                rd.fecha,
                v.placa,
                v.descripcion AS vehiculo,
                vend.id_vendedor AS id_vendedor,
                vend.nombre AS nombre_vendedor
            FROM rutas_diarias rd
            INNER JOIN vehiculos v ON rd.id_vehiculo = v.id_vehiculo
            LEFT JOIN vendedores vend ON v.id_vendedor = vend.id_vendedor
        `;

        if (fechaInicio && fechaFin) {
            request.input('inicio', sql.Date, fechaInicio);
            request.input('fin', sql.Date, fechaFin);
            query += ` WHERE rd.fecha >= @inicio AND rd.fecha <= @fin`;
        } else if (fechaInicio) {
            request.input('inicio', sql.Date, fechaInicio);
            query += ` WHERE rd.fecha = @inicio`;
        }

        query += ` ORDER BY rd.fecha DESC`;

        const result = await request.query(query);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error("Error obteniendo historial de rutas:", error);
        res.status(500).json({ error: "Error interno al obtener los registros." });
    }
});

// 3. RUTA DETALLES: JSON
router.get('/:id_ruta/auditoria', async (req, res) => {
    const { id_ruta } = req.params;
    try {
        const pool = await poolPromiseRutas;
        const resultRuta = await pool.request()
            .input('id', sql.Int, id_ruta)
            .query('SELECT CAST(DECOMPRESS(datos_ruta) AS VARCHAR(MAX)) AS datos_ruta FROM rutas_diarias WHERE id_ruta_diaria = @id');

        if (resultRuta.recordset.length === 0) return res.status(404).json({ error: "Ruta no encontrada." });

        const resultViajes = await pool.request()
            .input('id', sql.Int, id_ruta)
            .query(`SELECT hora_inicio, latitud_inicio, longitud_inicio, hora_fin, latitud_final, longitud_final FROM viajes WHERE id_ruta_diaria = @id ORDER BY hora_inicio ASC`);

        let eventosProcesados = [];
        try {
            const rawData = resultRuta.recordset[0].datos_ruta;
            eventosProcesados = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;
        } catch (parseError) {
            console.error("Error al decodificar JSON:", parseError);
        }

        res.status(200).json({ eventosJSON: eventosProcesados, viajesAnaliticos: resultViajes.recordset });
    } catch (error) {
        res.status(500).json({ error: "Error interno al obtener los detalles." });
    }
});

// RUTA: GET /api/rutas/registros/conteo
router.get('/conteo', async (req, res) => {
    try {
        const pool = await poolPromiseRutas;
        const result = await pool.request().query('SELECT COUNT(*) AS total FROM rutas_diarias');
        
        res.status(200).json({ total: result.recordset[0].total });
    } catch (error) {
        console.error("Error obteniendo el conteo de rutas:", error);
        res.status(500).json({ error: "Error interno al obtener el conteo." });
    }
});

// RUTA: DELETE /api/rutas/registros/:id_ruta
router.delete('/:id_ruta', async (req, res) => {
    const { id_ruta } = req.params;
    
    try {
        const pool = await poolPromiseRutas;
        const transaction = new sql.Transaction(pool);
        await transaction.begin();
        
        try {
            await transaction.request()
                .input('id', sql.Int, id_ruta)
                .query('DELETE FROM viajes WHERE id_ruta_diaria = @id');
                
            await transaction.request()
                .input('id', sql.Int, id_ruta)
                .query('DELETE FROM rutas_diarias WHERE id_ruta_diaria = @id');
                
            await transaction.commit();
            res.status(200).json({ mensaje: "Ruta y viajes eliminados correctamente." });
            
        } catch (deleteError) {
            await transaction.rollback();
            throw deleteError;
        }
        
    } catch (error) {
        console.error("Error eliminando ruta:", error);
        res.status(500).json({ error: "Error interno al eliminar la ruta." });
    }
});

module.exports = router;