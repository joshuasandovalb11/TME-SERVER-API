const express = require('express');
const { buscarClienteApp, buscarClientesPorVendedor } = require('../services/clientes.service');

const router = express.Router();

router.get('/app-search', async (req, res) => {
  const { id } = req.query;

  console.log(`[API SQL] 🔍 Iniciando búsqueda para App Móvil. ID Cliente: ${id}`);

  if (!id) {
    return res.status(400).json({ message: 'Falta el ID del cliente' });
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

router.get('/vendedor/:vend', async (req, res) => {
  const vendedorSeleccionado = req.params.vend;
  console.log(`[SQL API] Solicitando clientes para el vendedor: ${vendedorSeleccionado}`);

  try {
    const clientesProcesados = await buscarClientesPorVendedor(vendedorSeleccionado);
    console.log(`✅ Se enviarán ${clientesProcesados.length} clientes del vendedor ${vendedorSeleccionado}.`);
    return res.status(200).json(clientesProcesados);
  } catch (error) {
    console.error('❌ Error buscando clientes del vendedor:', error.message);
    return res.status(500).json({ message: 'Error interno SQL' });
  }
});

module.exports = router;