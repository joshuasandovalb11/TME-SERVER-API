const express = require('express');
const { obtenerVendedores } = require('../services/clientes.service');

const router = express.Router();

router.get('/vendedores', async (req, res) => {
  console.log('[API] Solicitando lista de vendedores...');

  try {
    const listaVendedores = await obtenerVendedores();
    console.log(`✅ Vendedores encontrados: ${listaVendedores.length}`);
    return res.status(200).json(listaVendedores);
  } catch (error) {
    console.error('❌ Error cargando vendedores:', error.message);
    return res.status(500).json([]);
  }
});

module.exports = router;