const express = require('express');
const { obtenerCredencial } = require('../services/credenciales.service');

const router = express.Router();

router.get('/credenciales/:tipo', async (req, res) => {
  const { tipo } = req.params;
  console.log(`[SQL Server] Solicitando credencial tipo: ${tipo}`);

  try {
    const credencial = await obtenerCredencial(tipo);

    if (credencial) {
      return res.status(200).json(credencial);
    }

    return res.status(404).json({ message: 'Credencial no encontrada' });
  } catch (error) {
    console.error('❌ Error obteniendo credencial:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

module.exports = router;