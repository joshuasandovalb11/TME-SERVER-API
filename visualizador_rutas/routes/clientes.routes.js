// visualizador_rutas/routes/clientes.routes.js
const express = require('express');
const router = express.Router();
const service = require('../services/clientes.service');

router.get('/clientes', (req, res) => service.getClientes(req, res));

module.exports = router;
