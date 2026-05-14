// visualizador_rutas/index.js
const express = require('express');
const router = express.Router();

router.use('/visualizador/rutas', require('./routes/rutas.routes'));
router.use('/', require('./routes/clientes.routes'));
router.use('/', require('./routes/vendedores.routes'));

module.exports = router;
