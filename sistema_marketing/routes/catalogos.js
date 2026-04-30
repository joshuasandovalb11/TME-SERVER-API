// sistema_marketing/routes/catalogos.js
const express = require('express');
const router = express.Router();
const { sql, poolRemotoPromise } = require('../db_remota');

// =====================================
// 1. CATÁLOGOS BASE (Sin dependencias)
// =====================================

// GRUPOS EMPRESARIALES
router.get('/grupos-empresariales', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT ID_GRUPO_EMPRESARIAL as id, CAST(DESC_GRUPO_EMPRESARIAL AS VARCHAR(50)) as nombre
            FROM PBIT_GRUPOS_EMPRESARIALES
            ORDER BY DESC_GRUPO_EMPRESARIAL ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo grupos empresariales:', error.message);
        res.status(500).json({ error: 'Error al obtener grupos empresariales' });
    }
});

// VENDEDORES (Activos y Tipo E)
router.get('/vendedores', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT ID_VENDEDOR as id, NOM_VENDEDOR as nombre
            FROM PBIT_VENDEDORES
            WHERE (INACTIVO = 0 OR INACTIVO IS NULL)
              AND TIPO = 'E'
            ORDER BY NOM_VENDEDOR ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo vendedores:', error.message);
        res.status(500).json({ error: 'Error al obtener vendedores' });
    }
});

// ZONAS
router.get('/zonas', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT ID_ZONA as id, DESCRIPCION as nombre
            FROM PBIT_ZONAS
            ORDER BY DESCRIPCION ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo zonas:', error.message);
        res.status(500).json({ error: 'Error al obtener zonas' });
    }
});

// PROVEEDORES
router.get('/proveedores', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT ID_PROVEEDOR as id, RAZON_SOCIAL_PROV as nombre
            FROM PBIT_PROVEEDORES
            ORDER BY RAZON_SOCIAL_PROV ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo proveedores:', error.message);
        res.status(500).json({ error: 'Error al obtener proveedores' });
    }
});

// ARTÍCULOS (Solo los que NO están descontinuados)
router.get('/articulos', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT 
                ID_PRODUCTO as id, 
                COD_PRODUCTO as codigo, 
                CAST(DESC_PRODUCTO AS VARCHAR(250)) as nombre 
            FROM PBIT_ARTICULOS_2
            WHERE ISNULL(LTRIM(RTRIM(DESCONTINUADO)), '0') <> '1'
            ORDER BY DESC_PRODUCTO ASC
        `);
        
        const data = result.recordset.map(row => ({
            id: row.id,
            nombre: `[${row.codigo}] ${row.nombre}`
        }));
        
        res.json(data);
    } catch (error) {
        console.error('❌ Error obteniendo artículos:', error.message);
        res.status(500).json({ error: 'Error al obtener artículos' });
    }
});

// MARCAS
router.get('/marcas', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT ID_MARCA as id, NOM_MARCA as nombre
            FROM PBIT_MARCAS
            ORDER BY NOM_MARCA ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo marcas:', error.message);
        res.status(500).json({ error: 'Error al obtener marcas' });
    }
});

// PAÍSES
router.get('/paises', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT ID_PAIS as id, NOM_PAIS as nombre
            FROM PBIT_PAISES
            ORDER BY NOM_PAIS ASC
        `);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo países:', error.message);
        res.status(500).json({ error: 'Error al obtener países' });
    }
});

// FECHAS DISPONIBLES (Días que tienen facturas registradas)
router.get('/fechas-disponibles', async (req, res) => {
    try {
        const pool = await poolRemotoPromise;
        const result = await pool.request().query(`
            SELECT DISTINCT CONVERT(VARCHAR(10), FECHA, 120) as fecha 
            FROM PBIT_FACTURASCLIE_2 
            WHERE FECHA IS NOT NULL 
            ORDER BY fecha DESC
        `);

        const fechas = result.recordset.map(row => row.fecha);
        res.json(fechas);
    } catch (error) {
        console.error('❌ Error obteniendo fechas disponibles:', error.message);
        res.status(500).json({ error: 'Error al obtener fechas disponibles' });
    }
});



// ======================================
// 2. CATÁLOGOS EN CASCADA (Geográficos)
// ======================================

// ESTADOS (Permite filtrar por ?idPais=X)
router.get('/estados', async (req, res) => {
    const { idPais } = req.query;
    try {
        const pool = await poolRemotoPromise;
        const request = pool.request();
        
        let query = `SELECT ID_ESTADO as id, NOM_ESTADO as nombre, ID_PAIS as idPais FROM PBIT_ESTADOS WHERE 1=1`;
        
        if (idPais) {
            query += ` AND ID_PAIS = @idPais`;
            request.input('idPais', sql.Int, idPais);
        }
        
        query += ` ORDER BY NOM_ESTADO ASC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo estados:', error.message);
        res.status(500).json({ error: 'Error al obtener estados' });
    }
});

// CIUDADES (Permite filtrar por ?idEstado=X)
router.get('/ciudades', async (req, res) => {
    const { idEstado } = req.query;
    try {
        const pool = await poolRemotoPromise;
        const request = pool.request();
        
        let query = `SELECT ID_CIUDAD as id, NOM_CIUDAD as nombre, ID_ESTADO as idEstado FROM PBIT_CIUDADES WHERE 1=1`;
        
        if (idEstado) {
            query += ` AND ID_ESTADO = @idEstado`;
            request.input('idEstado', sql.Int, idEstado);
        }
        
        query += ` ORDER BY NOM_CIUDAD ASC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo ciudades:', error.message);
        res.status(500).json({ error: 'Error al obtener ciudades' });
    }
});

// COLONIAS (Permite filtrar por ?idCiudad=X)
router.get('/colonias', async (req, res) => {
    const { idCiudad } = req.query;
    try {
        const pool = await poolRemotoPromise;
        const request = pool.request();
        
        let query = `SELECT ID_COLONIA as id, NOM_COLONIA as nombre, CODIGO_POSTAL as cp, ID_CIUDAD as idCiudad FROM PBIT_COLONIAS WHERE 1=1`;
        
        if (idCiudad) {
            query += ` AND ID_CIUDAD = @idCiudad`;
            request.input('idCiudad', sql.Int, idCiudad);
        }
        
        query += ` ORDER BY NOM_COLONIA ASC`;
        const result = await request.query(query);
        res.json(result.recordset);
    } catch (error) {
        console.error('❌ Error obteniendo colonias:', error.message);
        res.status(500).json({ error: 'Error al obtener colonias' });
    }
});

module.exports = router;