const express = require('express');
const router = express.Router();
const { sql, poolPromise } = require('./db');

// ==========================================
// ENDPOINTS PARA LA APP MÓVIL
// ==========================================

/**
 * Valida el acceso de un chofer/vendedor.
 * Si no tiene DeviceID, lo vincula automáticamente.
 */
router.get('/validar-dispositivo', async (req, res) => {
    const { telefono, id } = req.query; // 'id' es el installationId de Expo

    if (!telefono || !id) {
        return res.status(400).json({ autorizado: false, mensaje: "Faltan datos (Teléfono o ID)" });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('tel', sql.VarChar, telefono)
            .query('SELECT Nombre, DeviceID, Activo FROM Empleados WHERE Telefono = @tel');

        const empleado = result.recordset[0];

        if (!empleado) {
            return res.status(404).json({ autorizado: false, mensaje: "Número no registrado" });
        }

        if (empleado.Activo === false) {
            return res.status(403).json({ autorizado: false, mensaje: "Usuario bloqueado" });
        }

        // AUTO-REGISTRO: Vincular el dispositivo si está vacío
        if (!empleado.DeviceID) {
            await pool.request()
                .input('tel', sql.VarChar, telefono)
                .input('devId', sql.VarChar, id)
                .query('UPDATE Empleados SET DeviceID = @devId WHERE Telefono = @tel');
            
            return res.json({ autorizado: true, mensaje: "Dispositivo vinculado con éxito" });
        }

        // VALIDACIÓN: El ID debe coincidir con el registrado
        if (empleado.DeviceID === id) {
            return res.json({ autorizado: true });
        } else {
            return res.status(401).json({ autorizado: false, mensaje: "Este número ya está vinculado a otro celular" });
        }

    } catch (error) {
        console.error("Error en validar-dispositivo:", error.message);
        res.status(500).json({ error: "Error interno del servidor" });
    }
});

// ==========================================
// ENDPOINTS PARA EL PANEL ADMINISTRATIVO
// ==========================================

// 1. Obtener todos los empleados
router.get('/admin/lista', async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT * FROM Empleados ORDER BY Nombre ASC');
        res.json(result.recordset);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// 2. Crear un nuevo empleado
router.post('/admin/crear', async (req, res) => {
    const { telefono, nombre } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('tel', sql.VarChar, telefono)
            .input('nom', sql.VarChar, nombre)
            .query('INSERT INTO Empleados (Telefono, Nombre, Activo) VALUES (@tel, @nom, 1)');
        res.json({ mensaje: "Empleado creado correctamente" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 3. Editar datos de un empleado (Nombre, Teléfono o Estado Activo)
router.put('/admin/editar/:id', async (req, res) => {
    const { id } = req.params;
    const { telefono, nombre, activo } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .input('tel', sql.VarChar, telefono)
            .input('nom', sql.VarChar, nombre)
            .input('act', sql.Bit, activo)
            .query(`
                UPDATE Empleados 
                SET Telefono = @tel, Nombre = @nom, Activo = @act 
                WHERE ID = @id
            `);
        res.json({ mensaje: "Empleado actualizado correctamente" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 4. Liberar DeviceID (Para que pueda usar otro celular)
router.post('/admin/liberar', async (req, res) => {
    const { id } = req.body;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE Empleados SET DeviceID = NULL WHERE ID = @id');
        res.json({ mensaje: "Dispositivo liberado correctamente" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 5. Eliminar un empleado
router.delete('/admin/eliminar/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('id', sql.Int, id)
            .query('DELETE FROM Empleados WHERE ID = @id');
        res.json({ mensaje: "Empleado eliminado" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;