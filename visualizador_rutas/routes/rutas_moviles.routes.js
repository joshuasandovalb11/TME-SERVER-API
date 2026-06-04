const express = require('express');
const router = express.Router();
const rutasMovilesService = require('../services/rutas_moviles.service');

router.post('/batch', async (req, res) => {
  try {
    const { deviceId, date, columns, events } = req.body;

    if (!deviceId || !date || !columns || !events || !Array.isArray(events)) {
      return res.status(400).json({ error: 'Payload inválido. Faltan propiedades obligatorias.' });
    }

    const result = await rutasMovilesService.procesarBatchTelemetry(deviceId, date, columns, events);

    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error en POST /batch telemetry:', error.message || error);
    if (error.message === 'UNAUTHORIZED') {
      return res.status(401).json({ error: 'Dispositivo no autorizado o inactivo.' });
    }
    if (error.message.startsWith('INVALID_PAYLOAD')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error interno del servidor procesando telemetría.' });
  }
});

router.get('/:id_ruta_movil', (req, res) => rutasMovilesService.getRutaMovilDetalle(req, res));

module.exports = router;
