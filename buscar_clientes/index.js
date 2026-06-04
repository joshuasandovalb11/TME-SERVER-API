const express = require('express');

const router = express.Router();

// Rutas Generales
const clientesGeneralRoutes = require('./routes/general/clientes.routes');
const dispositivosRoutes = require('./routes/general/dispositivos.routes');

const rutasGeneral = express.Router();
rutasGeneral.use('/clientes', clientesGeneralRoutes);
rutasGeneral.use('/dispositivos', dispositivosRoutes);

// Rutas Supervisor
const clientesSupervisorRoutes = require('./routes/supervisor/clientes.routes');
const vendedoresRoutes = require('./routes/supervisor/vendedores.routes');
const visitasRoutes = require('./routes/supervisor/visitas.routes');
const credencialesRoutes = require('./routes/supervisor/credenciales.routes');

const rutasSupervisor = express.Router();
rutasSupervisor.use('/clientes', clientesSupervisorRoutes);
rutasSupervisor.use('/', vendedoresRoutes);
rutasSupervisor.use('/', visitasRoutes);
rutasSupervisor.use('/', credencialesRoutes);

// Montaje principal
router.use('/general', rutasGeneral);
router.use('/supervisor', rutasSupervisor);

module.exports = router;