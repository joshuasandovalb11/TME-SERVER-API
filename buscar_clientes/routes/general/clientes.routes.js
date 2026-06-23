const express = require('express');
const { buscarClienteApp } = require('../../services/general/clientes.service');

const router = express.Router();

router.get('/app-search', async (req, res) => {
  const { id } = req.query;

  console.log(`[API SQL] 🔍 Iniciando búsqueda para App Móvil. ID Cliente: ${id}`);

  if (!id || isNaN(Number(id))) {
    return res.status(400).json({ message: 'El ID del cliente no es válido' });
  }

  try {
    const sucursales = await buscarClienteApp(id);

    console.log(`✅ Búsqueda finalizada. Registros encontrados: ${sucursales.length}`);
    return res.status(200).json(sucursales);
  } catch (error) {
    console.error('❌ Error en app-search:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

module.exports = router;
