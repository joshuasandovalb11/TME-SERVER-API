const express = require('express');

const router = express.Router();

const clientesRoutes = require('./routes/clientes.routes');
const vendedoresRoutes = require('./routes/vendedores.routes');
const visitasRoutes = require('./routes/visitas.routes');
const credencialesRoutes = require('./routes/credenciales.routes');
const dispositivosRoutes = require('./routes/dispositivos.routes');

router.use('/clientes', clientesRoutes);
router.use('/', vendedoresRoutes);
router.use('/', visitasRoutes);
router.use('/', credencialesRoutes);
router.use('/dispositivos', dispositivosRoutes);

module.exports = router;