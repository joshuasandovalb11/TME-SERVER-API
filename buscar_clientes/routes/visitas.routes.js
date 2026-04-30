const express = require('express');
const {
  obtenerVisitas,
  alternarVisita,
  obtenerHistorial,
  resetearVisitas,
} = require('../services/visitas.service');

const router = express.Router();

router.get('/visitas/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[SQL Server] Solicitando visitas para DeviceID: ${deviceId}`);

  try {
    const visitados = await obtenerVisitas(deviceId);
    return res.status(200).json(visitados);
  } catch (error) {
    console.error('❌ Error obteniendo visitas:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

router.post('/visitas/toggle', async (req, res) => {
  const { deviceId, clienteId, sucursalId, sucursalNombre } = req.body;

  if (!deviceId || !clienteId) {
    return res.status(400).json({ message: 'Faltan datos obligatorios.' });
  }

  console.log(`[SQL Server] Registrando visita -> Device: ${deviceId}, Cliente: ${clienteId}, Suc: ${sucursalId ? parseInt(sucursalId) : 0}`);

  try {
    const result = await alternarVisita({ deviceId, clienteId, sucursalId, sucursalNombre });
    return res.status(200).json(result);
  } catch (error) {
    console.error('❌ Error registrando visita:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

router.get('/visitas/historial/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[SQL Server] Solicitando historial detallado para DeviceID: ${deviceId}`);

  try {
    const historial = await obtenerHistorial(deviceId);
    return res.status(200).json(historial);
  } catch (error) {
    console.error('❌ Error obteniendo historial:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

router.delete('/visitas/reset/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[SQL Server] 🔥 RESET de visitas para DeviceID: ${deviceId}`);

  try {
    await resetearVisitas(deviceId);
    return res.status(200).json({ message: 'Historial borrado correctamente.' });
  } catch (error) {
    console.error('❌ Error reseteando visitas:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

module.exports = router;