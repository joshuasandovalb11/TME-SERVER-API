const express = require('express');
const router = express.Router();
const dispositivosService = require('../../services/general/dispositivos.service');

router.post('/activar', async (req, res) => {
  try {
    const { idVendedor, pin, idDispositivo, modeloDispositivo } = req.body;

    if (!idVendedor || !pin || !idDispositivo || !modeloDispositivo) {
      return res.status(400).json({ 
        error: 'Faltan parámetros requeridos (idVendedor, pin, idDispositivo, modeloDispositivo).' 
      });
    }

    const resultado = await dispositivosService.activarDispositivo(idVendedor, pin, idDispositivo, modeloDispositivo);
    
    return res.status(200).json(resultado);
  } catch (error) {
    console.error('❌ Error en ruta /activar dispositivo:', error.message || error);
    if (error.message.includes('PIN inválido')) {
      return res.status(401).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Error interno del servidor al activar dispositivo.' });
  }
});

module.exports = router;
