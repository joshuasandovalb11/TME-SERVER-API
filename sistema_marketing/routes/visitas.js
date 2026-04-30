// sistema_marketing/routes/visitas.js
const express = require('express');
const router = express.Router();
const { sql, poolRutasMarketing } = require('../db_rutas_marketing');

/**
 * GET /api/visitas/cliente/:idCliente
 * Busca visitas basadas en proximidad geográfica (GPS)
 */
router.get('/cliente/:idCliente', async (req, res) => {
    const { idCliente } = req.params;
    const { lat, lng, fechaInicio, fechaFin } = req.query;

    if (!lat || !lng) {
        return res.status(400).json({ error: "Se requieren coordenadas (lat, lng) para buscar visitas." });
    }

    const fFin = fechaFin || new Date().toISOString().split('T')[0];
    const fIni = fechaInicio || new Date(new Date().setDate(new Date().getDate() - 90)).toISOString().split('T')[0];

    try {
        const pool = await poolRutasMarketing;
        const request = pool.request();

        request.input('lat', sql.Decimal(11, 8), parseFloat(lat));
        request.input('lng', sql.Decimal(11, 8), parseFloat(lng));
        request.input('fIni', sql.Date, fIni);
        request.input('fFin', sql.Date, fFin);

        const query = `
            WITH ViajesConEstadia AS (
                SELECT 
                    id_ruta_diaria,
                    latitud_final,
                    longitud_final,
                    hora_inicio,
                    hora_fin,
                    LEAD(hora_inicio) OVER (PARTITION BY id_ruta_diaria ORDER BY hora_inicio) AS inicio_siguiente_viaje
                FROM viajes
            )
            SELECT 
                rd.fecha,
                rd.id_vendedor as vendedorId,
                v.placa,
                ve.hora_inicio as horaLlegada,
                ve.hora_fin as horaSalida,
                ISNULL(DATEDIFF(MINUTE, CAST(ve.hora_fin AS DATETIME), CAST(ve.inicio_siguiente_viaje AS DATETIME)), 0) as duracionMinutos,
                (6371000 * ACOS(
                    COS(RADIANS(@lat)) * COS(RADIANS(ve.latitud_final)) * COS(RADIANS(ve.longitud_final) - RADIANS(@lng)) + 
                    SIN(RADIANS(@lat)) * SIN(RADIANS(ve.latitud_final))
                )) AS distanciaMetros
            FROM rutas_diarias rd
            INNER JOIN ViajesConEstadia ve ON rd.id_ruta_diaria = ve.id_ruta_diaria
            INNER JOIN vehiculos v ON rd.id_vehiculo = v.id_vehiculo
            WHERE rd.fecha >= @fIni AND rd.fecha <= @fFin
            AND (6371000 * ACOS(
                COS(RADIANS(@lat)) * COS(RADIANS(ve.latitud_final)) * COS(RADIANS(ve.longitud_final) - RADIANS(@lng)) + 
                SIN(RADIANS(@lat)) * SIN(RADIANS(ve.latitud_final))
            )) <= 60 
            ORDER BY rd.fecha DESC, ve.hora_inicio DESC
        `;

        const result = await request.query(query);

        const lastVisitResult = await pool.request()
            .input('lat', sql.Decimal(11, 8), parseFloat(lat))
            .input('lng', sql.Decimal(11, 8), parseFloat(lng))
            .query(`
                SELECT TOP 1 rd.fecha, rd.id_vendedor
                FROM rutas_diarias rd
                INNER JOIN viajes vi ON rd.id_ruta_diaria = vi.id_ruta_diaria
                WHERE (6371000 * ACOS(
                    COS(RADIANS(@lat)) * COS(RADIANS(vi.latitud_final)) * COS(RADIANS(vi.longitud_final) - RADIANS(@lng)) + 
                    SIN(RADIANS(@lat)) * SIN(RADIANS(vi.latitud_final))
                )) <= 60
                ORDER BY rd.fecha DESC
            `);

        res.json({
            historialVisitas: result.recordset,
            ultimaVisitaAbsoluta: lastVisitResult.recordset[0] || null
        });

    } catch (error) {
        console.error('❌ Error buscando visitas GPS:', error.message);
        res.status(500).json({ error: 'Error al buscar visitas GPS', detalle: error.message });
    }
});

module.exports = router;