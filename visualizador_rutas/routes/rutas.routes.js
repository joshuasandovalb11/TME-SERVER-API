// visualizador_rutas/routes/rutas.routes.js
const express = require('express');
const multer = require('multer');
const { getRutasResumen, getRutaDetalle, getAvailableDates, getRutasBatch } = require('../services/rutas.service');
const { getRutaFromExcel, getRutasFromExcelBatch } = require('../services/excel.service');

const router = express.Router();
// upload.array permite recibir múltiples archivos en la misma petición
const upload = multer({ dest: 'temp_uploads/' });

// GET /api/visualizador/rutas/fechas
router.get('/fechas', (req, res) => getAvailableDates(req, res));

// GET /api/visualizador/rutas?fecha=YYYY-MM-DD
router.get('/', (req, res) => getRutasResumen(req, res));

// GET /api/visualizador/rutas/batch?ids=12,15,22
router.get('/batch', (req, res) => getRutasBatch(req, res));

// POST /api/visualizador/rutas/excel/batch
router.post('/excel/batch', upload.array('archivosExcel', 10), (req, res) => getRutasFromExcelBatch(req, res));

// POST /api/visualizador/rutas/excel (Individual)
router.post('/excel', upload.single('archivoExcel'), (req, res) => getRutaFromExcel(req, res));

// GET /api/visualizador/rutas/:id_ruta
router.get('/:id_ruta', (req, res) => getRutaDetalle(req, res));

module.exports = router;