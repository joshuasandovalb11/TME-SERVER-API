const express = require('express');
const multer = require('multer');
const { getRutasResumen, getRutaDetalle, getAvailableDates } = require('../services/rutas.service');
const { getRutaFromExcel } = require('../services/excel.service');

const router = express.Router();
const upload = multer({ dest: 'temp_uploads/' });

// GET /api/visualizador/rutas/fechas - Lista fechas disponibles
router.get('/fechas', (req, res) => getAvailableDates(req, res));

// GET /api/visualizador/rutas?fecha=YYYY-MM-DD&vendedor=ABC&limite=100
router.get('/', (req, res) => getRutasResumen(req, res));

// POST /api/visualizador/rutas/excel - Procesa Excel sin guardar en BD
router.post('/excel', upload.single('archivoExcel'), (req, res) => getRutaFromExcel(req, res));

// GET /api/visualizador/rutas/:id_ruta?incluirClientes=true&minStopDuration=5
router.get('/:id_ruta', (req, res) => getRutaDetalle(req, res));

module.exports = router;
