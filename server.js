require('dotenv').config();
const express = require("express");
const cors = require("cors");
const authRoutes = require('./auth');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/auth', authRoutes);
app.use('/sistema_marketing', require('./sistema_marketing'));
app.use('/rutas', require('./sistema_rutas'));
app.use('/api', require('./buscar_clientes'));
app.use('/api', require('./visualizador_rutas'));
app.use('/admin', express.static('public_admin'));

// ENDPOINT HEALTH CHECK
app.get("/api/health", async (req, res) => {
  try {
    const pool = await poolPromise;
    await pool.request().query('SELECT 1'); 
    res.status(200).json({ status: 'OK', database: 'connected' });
  } catch (error) {
    console.error("Health Check Failed:", error.message);
    res.status(500).json({ status: 'ERROR', database: 'disconnected' });
  }
});

// Heartbeat para debug
setInterval(() => {
    console.log(`[Heartbeat] Servidor activo. Uptime: ${process.uptime()}s`);
}, 60000);

app.listen(port, () => {
  console.log(`API Interna SQL corriendo en http://localhost:${port}`);
  console.log('--- Configuración ---');
  console.log(`Servidor activo en puerto: ${port}`);
});