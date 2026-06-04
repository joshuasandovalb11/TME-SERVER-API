// visualizador_rutas/index.js
const express = require('express');
const router = express.Router();

const rutasMovilesRoutes = require('./routes/rutas_moviles.routes');

router.use('/visualizador/rutas/moviles', rutasMovilesRoutes);
router.use('/visualizador/rutas', require('./routes/rutas.routes'));
router.use('/visualizador', require('./routes/behavior.routes'));
router.use('/visualizador', require('./routes/vendedores.routes'));
router.use('/', require('./routes/clientes.routes'));

module.exports = router;
