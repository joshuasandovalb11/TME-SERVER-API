// sistema_marketing/index.js
const express = require('express');
const router = express.Router();

// Importacion
const analisisRoutes = require('./routes/analisis');
const catalogosRoutes = require('./routes/catalogos');
const clientesRoutes = require('./routes/clientes');
const facturasRoutes = require('./routes/facturas');
const visitasRoutes = require('./routes/visitas');

// Rutas para exponer
router.use('/analisis', analisisRoutes); 
router.use('/catalogos', catalogosRoutes);
router.use('/clientes', clientesRoutes);
router.use('/facturas', facturasRoutes);
router.use('/visitas', visitasRoutes);

router.get('/ping', (req, res) => {
    res.json({ mensaje: "Directorio /sistema_marketing funcionando correctamente" });
});

module.exports = router;