// visualizador_rutas/routes/behavior.routes.js
const express = require('express');
const { getBehaviorAnalytics } = require('../services/behavior.service');

const router = express.Router();

// Ruta: /api/visualizador/behavior
router.get('/behavior', getBehaviorAnalytics);

module.exports = router;