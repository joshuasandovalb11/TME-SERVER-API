// sistema_marketing/routes/catalogos.js
const express = require('express');
const router = express.Router();
const { sql, poolPromiseRutas } = require('../db_rutas');

// ==========================================
// MÓDULO: VENDEDORES
// ==========================================

// Obtener todos los vendedores (activos e inactivos)
router.get('/vendedores', async (req, res) => {
    try {
        const pool = await poolPromiseRutas;
        const result = await pool.request().query('SELECT * FROM vendedores ORDER BY nombre ASC');
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo vendedores: " + error.message });
    }
});

// Registrar un NUEVO vendedor
router.post('/vendedores', async (req, res) => {
    const { id_vendedor, nombre } = req.body;

    if (!id_vendedor || !nombre) {
        return res.status(400).json({ error: "El ID (iniciales) y el nombre son obligatorios." });
    }

    try {
        const pool = await poolPromiseRutas;
        await pool.request()
            .input('id', sql.VarChar(50), id_vendedor.toUpperCase())
            .input('nombre', sql.NVarChar(150), nombre)
            .query('INSERT INTO vendedores (id_vendedor, nombre, estatus) VALUES (@id, @nombre, 1)');
        
        res.status(201).json({ mensaje: "Vendedor registrado correctamente." });
    } catch (error) {
        if (error.number === 2627) {
            return res.status(409).json({ error: "Ya existe un vendedor con esas iniciales." });
        }
        res.status(500).json({ error: "Error registrando vendedor: " + error.message });
    }
});

// Editar un vendedor
router.put('/vendedores/:id', async (req, res) => {
    const { id } = req.params;
    const { nombre, estatus } = req.body;

    try {
        const pool = await poolPromiseRutas;
        await pool.request()
            .input('id', sql.VarChar(50), id)
            .input('nombre', sql.NVarChar(150), nombre)
            .input('estatus', sql.Bit, estatus)
            .query('UPDATE vendedores SET nombre = @nombre, estatus = @estatus WHERE id_vendedor = @id');
        
        res.status(200).json({ mensaje: "Vendedor actualizado correctamente." });
    } catch (error) {
        res.status(500).json({ error: "Error actualizando vendedor: " + error.message });
    }
});

// ==========================================
// MÓDULO: VEHÍCULOS
// ==========================================

// Obtener todos los vehículos con el nombre de su vendedor actual
router.get('/vehiculos', async (req, res) => {
    try {
        const pool = await poolPromiseRutas;
        const result = await pool.request().query(`
            SELECT v.id_vehiculo, v.placa, v.descripcion, v.id_vendedor, vend.nombre AS nombre_vendedor
            FROM vehiculos v
            LEFT JOIN vendedores vend ON v.id_vendedor = vend.id_vendedor
            ORDER BY v.placa ASC
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        res.status(500).json({ error: "Error obteniendo vehículos: " + error.message });
    }
});

// Registrar un NUEVO vehículo
router.post('/vehiculos', async (req, res) => {
    const { placa, descripcion, id_vendedor } = req.body;

    if (!placa) {
        return res.status(400).json({ error: "La placa es obligatoria." });
    }

    try {
        const pool = await poolPromiseRutas;
        await pool.request()
            .input('placa', sql.NVarChar(20), placa.toUpperCase())
            .input('descripcion', sql.NVarChar(100), descripcion)
            .input('id_vend', sql.VarChar(50), id_vendedor || null)
            .query('INSERT INTO vehiculos (placa, descripcion, id_vendedor) VALUES (@placa, @descripcion, @id_vend)');
        
        res.status(201).json({ mensaje: "Vehículo registrado correctamente." });
    } catch (error) {
        if (error.number === 2627) { 
            return res.status(409).json({ error: "Esta placa ya está registrada." });
        }
        res.status(500).json({ error: "Error registrando vehículo: " + error.message });
    }
});

// REASIGNAR un vehículo (Quitarle el carro a un vendedor y dárselo a otro)
router.put('/vehiculos/:id/asignacion', async (req, res) => {
    const { id } = req.params;
    const { id_vendedor } = req.body;

    try {
        const pool = await poolPromiseRutas;
        await pool.request()
            .input('id', sql.Int, id)
            .input('id_vend', sql.VarChar(50), id_vendedor)
            .query('UPDATE vehiculos SET id_vendedor = @id_vend WHERE id_vehiculo = @id');
        
        res.status(200).json({ mensaje: "Vehículo reasignado correctamente." });
    } catch (error) {
        res.status(500).json({ error: "Error reasignando vehículo: " + error.message });
    }
});

module.exports = router;