const express = require('express');
const { buscarClientesPorVendedor } = require('../../services/supervisor/clientes.service');

const router = express.Router();

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
