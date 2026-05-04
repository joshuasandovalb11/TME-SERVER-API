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

    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);

    if (Number.isNaN(latNum) || Number.isNaN(lngNum)) {
        return res.status(400).json({ error: "Coordenadas invalidas. Se esperan valores numericos para lat y lng." });
    }

    const radioMetros = 60;
    const latDelta = radioMetros / 111320;
    const cosLat = Math.cos((latNum * Math.PI) / 180);
    const lngDelta = radioMetros / (111320 * Math.max(Math.abs(cosLat), 0.000001));

    try {
        const pool = await poolRutasMarketing;
        const request = pool.request();

        request.input('lat', sql.Decimal(11, 8), latNum);
        request.input('lng', sql.Decimal(11, 8), lngNum);
        request.input('latMin', sql.Decimal(11, 8), latNum - latDelta);
        request.input('latMax', sql.Decimal(11, 8), latNum + latDelta);
        request.input('lngMin', sql.Decimal(11, 8), lngNum - lngDelta);
        request.input('lngMax', sql.Decimal(11, 8), lngNum + lngDelta);
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
            ),
            Candidatos AS (
                SELECT
                    rd.fecha,
                    rd.id_vendedor,
                    v.placa,
                    ve.hora_inicio,
                    ve.hora_fin,
                    ve.inicio_siguiente_viaje,
                    ve.latitud_final,
                    ve.longitud_final
                FROM rutas_diarias rd
                INNER JOIN ViajesConEstadia ve ON rd.id_ruta_diaria = ve.id_ruta_diaria
                INNER JOIN vehiculos v ON rd.id_vehiculo = v.id_vehiculo
                WHERE rd.fecha >= @fIni
                  AND rd.fecha <= @fFin
                  AND ve.latitud_final BETWEEN @latMin AND @latMax
                  AND ve.longitud_final BETWEEN @lngMin AND @lngMax
            ),
            Distancias AS (
                SELECT
                    c.fecha,
                    c.id_vendedor,
                    c.placa,
                    c.hora_inicio,
                    c.hora_fin,
                    c.inicio_siguiente_viaje,
                    (6371000 * ACOS(
                        CASE
                            WHEN (COS(RADIANS(@lat)) * COS(RADIANS(c.latitud_final)) * COS(RADIANS(c.longitud_final) - RADIANS(@lng)) +
                                  SIN(RADIANS(@lat)) * SIN(RADIANS(c.latitud_final))) > 1 THEN 1
                            WHEN (COS(RADIANS(@lat)) * COS(RADIANS(c.latitud_final)) * COS(RADIANS(c.longitud_final) - RADIANS(@lng)) +
                                  SIN(RADIANS(@lat)) * SIN(RADIANS(c.latitud_final))) < -1 THEN -1
                            ELSE (COS(RADIANS(@lat)) * COS(RADIANS(c.latitud_final)) * COS(RADIANS(c.longitud_final) - RADIANS(@lng)) +
                                  SIN(RADIANS(@lat)) * SIN(RADIANS(c.latitud_final)))
                        END
                    )) AS distanciaMetros
                FROM Candidatos c
            )
            SELECT 
                d.fecha,
                d.id_vendedor as vendedorId,
                d.placa,
                d.hora_inicio as horaLlegada,
                d.hora_fin as horaSalida,
                ISNULL(DATEDIFF(MINUTE, CAST(d.hora_fin AS DATETIME), CAST(d.inicio_siguiente_viaje AS DATETIME)), 0) as duracionMinutos,
                d.distanciaMetros
            FROM Distancias d
            WHERE d.distanciaMetros <= ${radioMetros}
            ORDER BY d.fecha DESC, d.hora_inicio DESC
        `;

        const result = await request.query(query);

        const lastVisitResult = await pool.request()
            .input('lat', sql.Decimal(11, 8), latNum)
            .input('lng', sql.Decimal(11, 8), lngNum)
            .input('latMin', sql.Decimal(11, 8), latNum - latDelta)
            .input('latMax', sql.Decimal(11, 8), latNum + latDelta)
            .input('lngMin', sql.Decimal(11, 8), lngNum - lngDelta)
            .input('lngMax', sql.Decimal(11, 8), lngNum + lngDelta)
            .query(`
                SELECT TOP 1 rd.fecha, rd.id_vendedor
                FROM rutas_diarias rd
                INNER JOIN viajes vi ON rd.id_ruta_diaria = vi.id_ruta_diaria
                WHERE vi.latitud_final BETWEEN @latMin AND @latMax
                  AND vi.longitud_final BETWEEN @lngMin AND @lngMax
                  AND (6371000 * ACOS(
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