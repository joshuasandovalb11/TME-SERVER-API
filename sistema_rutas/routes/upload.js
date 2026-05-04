// sistema_marketing/routes/upload.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const { sql, poolPromiseRutas } = require('../db_rutas');
const { procesarArchivoRuta } = require('../utils/parser');
const upload = multer({ dest: 'temp_uploads/' });

// RUTA: POST /api/rutas/upload
router.post('/', upload.single('archivoExcel'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No se proporcionó ningún archivo." });
    }

    const filePath = req.file.path;

    try {
        const datosProcesados = await procesarArchivoRuta(filePath);
        const { placa, fecha, datosRutaJSON, viajesAnaliticos } = datosProcesados;
        const pool = await poolPromiseRutas;

        const resultVehiculo = await pool.request()
            .input('placa', sql.NVarChar(20), placa)
            .query('SELECT id_vehiculo, id_vendedor FROM vehiculos WHERE placa = @placa');

        if (resultVehiculo.recordset.length === 0) {
            return res.status(404).json({ error: `El vehículo con placa ${placa} no está registrado en el sistema. Regístralo primero.` });
        }
        
        const idVehiculo = resultVehiculo.recordset[0].id_vehiculo;
        const idVendedor = resultVehiculo.recordset[0].id_vendedor;

        if (!idVendedor) {
            return res.status(400).json({ error: `El vehículo ${placa} está registrado, pero no tiene ningún vendedor asignado en el catálogo.` });
        }

        const resultDuplicado = await pool.request()
            .input('id_vehiculo', sql.Int, idVehiculo)
            .input('fecha', sql.Date, fecha)
            .query('SELECT id_ruta_diaria FROM rutas_diarias WHERE id_vehiculo = @id_vehiculo AND fecha = @fecha');

        if (resultDuplicado.recordset.length > 0) {
            return res.status(409).json({ error: `La ruta del vehículo ${placa} para la fecha ${fecha} ya fue ingresada anteriormente.` });
        }

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            const insertRuta = await transaction.request()
                .input('id_vehiculo', sql.Int, idVehiculo)
                .input('id_vendedor', sql.VarChar(50), idVendedor)
                .input('fecha', sql.Date, fecha)
                .input('datos_ruta', sql.VarChar(sql.MAX), datosRutaJSON)
                .query(`
                    INSERT INTO rutas_diarias (id_vehiculo, id_vendedor, fecha, datos_ruta) 
                    OUTPUT INSERTED.id_ruta_diaria 
                    VALUES (@id_vehiculo, @id_vendedor, @fecha, COMPRESS(@datos_ruta))
                `);

            const idRutaGenerada = insertRuta.recordset[0].id_ruta_diaria;

            for (const viaje of viajesAnaliticos) {
                await transaction.request()
                    .input('id_ruta_diaria', sql.Int, idRutaGenerada)
                    .input('hora_inicio', sql.VarChar(10), viaje.hora_inicio)
                    .input('latitud_inicio', sql.Decimal(11,8), viaje.latitud_inicio)
                    .input('longitud_inicio', sql.Decimal(11,8), viaje.longitud_inicio)
                    .input('hora_fin', sql.VarChar(10), viaje.hora_fin)
                    .input('latitud_final', sql.Decimal(11,8), viaje.latitud_final)
                    .input('longitud_final', sql.Decimal(11,8), viaje.longitud_final)
                    .query(`
                        INSERT INTO viajes 
                        (id_ruta_diaria, hora_inicio, latitud_inicio, longitud_inicio, hora_fin, latitud_final, longitud_final)
                        VALUES 
                        (@id_ruta_diaria, @hora_inicio, @latitud_inicio, @longitud_inicio, @hora_fin, @latitud_final, @longitud_final)
                    `);
            }

            await transaction.commit();

            res.status(200).json({
                mensaje: "Archivo procesado y guardado con éxito.",
                resumen: {
                    vehiculo: placa,
                    vendedor: idVendedor,
                    fecha: fecha,
                    eventosProcesados: JSON.parse(datosRutaJSON).length,
                    viajesRegistrados: viajesAnaliticos.length
                }
            });

        } catch (insertError) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                if (rollbackError.code !== 'EABORT') {
                    console.error("Error inesperado en rollback:", rollbackError);
                }
            }
            
            throw insertError; 
        }

    } catch (error) {
        console.error("Error procesando ruta:", error);
        res.status(500).json({ error: "Error interno procesando el archivo: " + error.message });
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

// RUTA: POST /api/rutas/upload/preview
router.post('/preview', upload.single('archivoExcel'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No se proporcionó ningún archivo." });
    }

    const filePath = req.file.path;

    try {
        const datosProcesados = await procesarArchivoRuta(filePath);
        const { placa, fecha, viajesAnaliticos } = datosProcesados;
        const pool = await poolPromiseRutas;

        const resultVehiculo = await pool.request()
            .input('placa', sql.NVarChar(20), placa)
            .query(`
                SELECT v.id_vehiculo, v.id_vendedor, vend.nombre AS nombre_vendedor 
                FROM vehiculos v
                LEFT JOIN vendedores vend ON v.id_vendedor = vend.id_vendedor
                WHERE v.placa = @placa
            `);

        const vehiculoEncontrado = resultVehiculo.recordset[0];
        
        let esDuplicado = false;
        if (vehiculoEncontrado) {
            const resultDuplicado = await pool.request()
                .input('id_vehiculo', sql.Int, vehiculoEncontrado.id_vehiculo)
                .input('fecha', sql.Date, fecha)
                .query('SELECT id_ruta_diaria FROM rutas_diarias WHERE id_vehiculo = @id_vehiculo AND fecha = @fecha');
            
            esDuplicado = resultDuplicado.recordset.length > 0;
        }

        res.status(200).json({
            placa,
            fecha,
            vendedorLabel: vehiculoEncontrado 
                ? `${vehiculoEncontrado.nombre_vendedor} (${vehiculoEncontrado.id_vendedor})` 
                : "Vehículo no registrado",
            viajesCount: viajesAnaliticos.length,
            idVendedor: vehiculoEncontrado?.id_vendedor || null,
            errorValidacion: !vehiculoEncontrado 
                ? "El vehículo no existe en el catálogo." 
                : esDuplicado 
                    ? "Esta ruta ya fue cargada anteriormente." 
                    : null
        });

    } catch (error) {
        res.status(500).json({ error: "Error analizando el archivo: " + error.message });
    } finally {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

module.exports = router;