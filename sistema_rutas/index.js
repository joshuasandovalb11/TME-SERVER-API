const express = require('express');
const router = express.Router();
require('./db_rutas'); 

const uploadRoutes = require('./routes/upload');
const registrosRoutes = require('./routes/registros');
const catalogosRoutes = require('./routes/catalogos');

router.use('/upload', uploadRoutes);
router.use('/registros', registrosRoutes);
router.use('/catalogos', catalogosRoutes);

router.get('/ping', (req, res) => {
    res.json({ mensaje: "El módulo de rutas está online" });
});

module.exports = router;