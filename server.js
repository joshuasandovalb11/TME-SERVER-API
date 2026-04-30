require('dotenv').config();
const express = require("express");
const cors = require("cors");
const { sql, poolPromise } = require('./db');
const marketingRoutes = require('./marketing');
const authRoutes = require('./auth');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const VENDOR_NAME_TO_INITIALS = {
  'EDGAR BARBOSA HIGUERA': 'BHE',
  'JUAN CARLOS CABANILLAS GAXIOLA': 'CGC',
  'LETICIA CERVANTES GONZALEZ': 'CGL',
  'MARCELINA DIAZ MILLAN': 'DMM',
  'DENISSE YURIRIA FLORES VELAZQUEZ': 'FVD',
  'LAURA NALLELY GARCIA REYES': 'GRL',
  'CARLOS JULIAN GARCIA VEGA': 'GVJ',
  'ANA LILIA GONZALEZ LARA': 'GLA',
  'CARLA GUADALUPE HERRERA LOPEZ': 'HLC',
  'GABRIELA MARTINEZ MADERA': 'MMG',
  'MEDINA JARAMILLO MARLIN': 'MJM',
  'JESUS ANGEL MEDRANO ELIZALDE': 'MEJ',
  'MARIO ENRIQUE MONTES PINEDA': 'MPM',
  'RODRIGO OLIVAS BATRES': 'OBR',
  'JESUS PEÑA GONZALEZ': 'PGJ',
  'JOEL PEREZ HERNANDEZ': 'PHJ',
  'YOLANDA RENTERIA RODRIGUEZ': 'RRY',
  'ANA MARIA REYES NEVARES': 'RNA',
  'MARIA ANTONIA RODRIGUEZ IBARRA': 'RIA',
  'YASMIN VIRIDIANA RODRIGUEZ PRECIADO': 'RPV',
  'ANDRES TAPIA LEDEZMA': 'TLA',
};

// ENDPOINT MARKETING
app.use('/api/marketing', marketingRoutes);

// ENDPOINT AUTH
app.use('/api/auth', authRoutes);
app.use('/sistema_marketing', require('./sistema_marketing'));
app.use('/rutas', require('./sistema_rutas'));
app.use('/api', require('./buscar_clientes'));
app.use('/admin', express.static('public_admin'));

// --- ENDPOINT GET (Lectura) ---
app.get("/api/clientes", async (req, res) => {
  console.log('[SQL Server API] GET /api/clientes');
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT ClienteID, NombreCliente, GPS, Vend, SucursalID, SucursalNombre, Ciudad, NombreComercial
      FROM Clientes
      WHERE GPS IS NOT NULL AND GPS LIKE '%,%'
    `);

    const clientesProcesados = result.recordset.map(row => {
        const gpsParts = row.GPS ? row.GPS.split(',') : [];
        let lat = 0, lng = 0;
        if (gpsParts.length === 2) {
            lat = parseFloat(gpsParts[0].trim());
            lng = parseFloat(gpsParts[1].trim());
        }
        
        const isVendorHome = row.NombreComercial && row.NombreComercial.toUpperCase().trim() === 'EMPLEADO TME';
        
        let vendorHomeInitial = undefined;
        if (isVendorHome && row.NombreCliente) {
            const cleanName = row.NombreCliente.toUpperCase().trim().replace(/\s+/g, ' ');
            vendorHomeInitial = VENDOR_NAME_TO_INITIALS[cleanName];
        }

        return {
            key: String(row.ClienteID).trim(),
            name: (row.NombreCliente || '').trim(),
            lat: lat,
            lng: lng,
            vendor: (row.Vend || '').trim(),
            branchNumber: row.SucursalID ? String(row.SucursalID).trim() : undefined,
            branchName: row.SucursalNombre ? row.SucursalNombre.trim() : undefined,
            city: row.Ciudad ? row.Ciudad.trim() : undefined,
            displayName: (row.NombreCliente || '').trim(),
            isVendorHome: isVendorHome,
            vendorHomeInitial: vendorHomeInitial
        };
    }).filter(c => c.lat !== 0 && c.lng !== 0);

    console.log(`✅ Enviando ${clientesProcesados.length} clientes.`);
    res.status(200).json(clientesProcesados);
  } catch (error) {
    console.error("❌ Error GET:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
  }
});

// --- ENDPOINT POST CLIENTES (Sincronización) ---
app.post("/api/clientes/sync", async (req, res) => {
  const clientesNuevos = req.body;
  console.log(`[SQL Server API] POST /api/clientes/sync - Recibidos ${clientesNuevos?.length} registros`);

  if (!Array.isArray(clientesNuevos) || clientesNuevos.length === 0) {
    return res.status(400).json({ message: "Lista vacía" });
  }

  let transaction;
  
  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    
    await transaction.begin();

    try {
        const requestClean = new sql.Request(transaction);
        await requestClean.query("TRUNCATE TABLE Clientes");
    } catch (e) {
        const requestDelete = new sql.Request(transaction);
        await requestDelete.query("DELETE FROM Clientes");
    }

    for (const [index, cliente] of clientesNuevos.entries()) {
        const requestInsert = new sql.Request(transaction);
        
        const generatedID = index + 1;
        const clienteIdRaw = parseInt(cliente.key);
        const clienteID = isNaN(clienteIdRaw) ? 0 : clienteIdRaw;
        
        const nombre = (cliente.name || '').replace(/'/g, "''");
        
        const lat = parseFloat(cliente.lat) || 0;
        const lng = parseFloat(cliente.lng) || 0;
        const gpsString = `${lat},${lng}`; 
        
        const vend = (cliente.vendor || '').replace(/'/g, "''");
        
        let sucursalID = 'NULL';
        if (cliente.branchNumber) {
            const s = parseInt(cliente.branchNumber);
            if (!isNaN(s)) sucursalID = s;
        }
        
        const sucursalNombre = cliente.branchName ? `'${cliente.branchName.replace(/'/g, "''")}'` : "''";
        const ciudad = cliente.city ? `'${cliente.city.replace(/'/g, "''")}'` : "NULL";

        let nombreComercialVal = 'NULL';
        if (cliente.isVendorHome) {
              nombreComercialVal = "'EMPLEADO TME'";
        } else if (cliente.commercialName) {
              nombreComercialVal = `'${cliente.commercialName.replace(/'/g, "''")}'`;
        }

        await requestInsert.query(`
            INSERT INTO Clientes (ID, ClienteID, NombreCliente, GPS, Vend, SucursalID, SucursalNombre, Ciudad, NombreComercial)
            VALUES (${generatedID}, ${clienteID}, '${nombre}', '${gpsString}', '${vend}', ${sucursalID}, ${sucursalNombre}, ${ciudad}, ${nombreComercialVal})
        `);
    }

    await transaction.commit();
    console.log("✅ Sincronización exitosa.");
    res.status(200).json({ message: "OK" });

  } catch (error) {
    console.error("❌ Error CRÍTICO en sync:", error.message);
    if (transaction) {
        try {
            await transaction.rollback();
        } catch (rollbackError) {
            console.log("Aviso: Rollback no necesario o fallido (transacción ya cerrada).");
        }
    }
    res.status(500).json({ message: `Error en BD: ${error.message}` });
  }
});

// ENDPOINT POST PEDIDOS (Sincronización Completa)
app.post("/api/pedidos/sync", async (req, res) => {
  const pedidosNuevos = req.body;
  console.log(`[SQL API] Sincronizando ${pedidosNuevos?.length} pedidos...`);

  if (!Array.isArray(pedidosNuevos) || pedidosNuevos.length === 0) {
    return res.status(400).json({ message: "Lista vacía" });
  }

  let transaction;
  try {
    const pool = await poolPromise;
    transaction = new sql.Transaction(pool);
    await transaction.begin();
    const request = new sql.Request(transaction);

    try {
      await request.query("TRUNCATE TABLE Pedidos");
    } catch {
      await request.query("DELETE FROM Pedidos");
    }

    for (const [i, p] of pedidosNuevos.entries()) {
      try {
        const pedidoID = parseInt(p.pedidoId) || 0;
        const vend = (p.vend || '').replace(/'/g, "''").substring(0, 10);
        
        let fecha = 'NULL';
        if (p.fecha && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha)) {
            fecha = `'${p.fecha}'`;
        }

        const clienteID = parseInt(p.clienteId) || 0;
        const nombreCliente = (p.nombreCliente || '').replace(/'/g, "''").substring(0, 250);
        const sucursalID = parseInt(p.sucursalId) || 'NULL';
        const sucursalNombre = (p.sucursalNombre || '').replace(/'/g, "''").substring(0, 100);
        
        const importeMN = parseFloat(p.importeMN) || 0;
        const importeUS = parseFloat(p.importeUS) || 0;

        const gpsCliente = p.gpsCliente ? `'${p.gpsCliente.replace(/'/g, "''").substring(0, 100)}'` : 'NULL';
        const gpsCaptura = p.gpsCaptura ? `'${p.gpsCaptura.replace(/'/g, "''").substring(0, 100)}'` : 'NULL';
        const gpsEnvio = p.gpsEnvio ? `'${p.gpsEnvio.replace(/'/g, "''").substring(0, 100)}'` : 'NULL';
        const procedencia = (p.procedencia || '').replace(/'/g, "''").substring(0, 50);

        await request.query(`
          INSERT INTO Pedidos (
            PedidoID, Vend, Fecha, ClienteID, NombreCliente, 
            SucursalID, SucursalNombre, ImporteMN, ImporteUS, 
            GPSCliente, GPSCaptura, GPSEnvio, Procedencia
          ) VALUES (
            ${pedidoID}, '${vend}', ${fecha}, ${clienteID}, '${nombreCliente}',
            ${sucursalID}, '${sucursalNombre}', ${importeMN}, ${importeUS},
            ${gpsCliente}, ${gpsCaptura}, ${gpsEnvio}, '${procedencia}'
          )
        `);
      } catch (err) {
        console.error(`Error no fatal en fila ${i} (Pedido ${p.pedidoId}): ${err.message}`);
      }
    }

    await transaction.commit();
    console.log("✅ Pedidos sincronizados correctamente.");
    res.status(200).json({ message: "OK" });

  } catch (error) {
    console.error("❌ Error CRÍTICO sync pedidos:", error);
    if (transaction) {
        try { await transaction.rollback(); } catch(e) { console.error("Error al rollback:", e.message); }
    }
    res.status(500).json({ message: error.message });
  }
});

/**
 * Permite filtrar por rango de fechas, vendedor, y/o cliente.
 * Si no se envían parámetros, devuelve TODOS los pedidos (límite opcional).
 */
app.get("/api/pedidos/buscar", async (req, res) => {
  const { fechaInicio, fechaFin, vend, clienteId } = req.query;

  console.log('[API Interna] Búsqueda de Pedidos recibida', req.query);

  try {
    const pool = await poolPromise;
    const request = pool.request();

    let queryBase = `
      SELECT 
        PedidoID, Vend, Fecha, ClienteID, NombreCliente, 
        SucursalID, SucursalNombre, ImporteMN, ImporteUS, 
        GPSCliente, GPSCaptura, GPSEnvio, Procedencia
      FROM Pedidos
    `;
    
    let condiciones = [];
    
    if (fechaInicio) {
      condiciones.push("Fecha >= @fechaInicio");
      request.input("fechaInicio", sql.Date, fechaInicio);
    }

    if (fechaFin) {
      condiciones.push("Fecha <= @fechaFin");
      request.input("fechaFin", sql.Date, fechaFin);
    }

    if (vend) {
      condiciones.push("Vend = @vend");
      request.input("vend", sql.VarChar(10), vend);
    }

    if (clienteId) {
      condiciones.push("ClienteID = @clienteId");
      request.input("clienteId", sql.Int, clienteId);
    }

    if (condiciones.length > 0) {
      queryBase += " WHERE " + condiciones.join(" AND ");
    }

    queryBase += " ORDER BY Fecha DESC";
    
    const result = await request.query(queryBase);

    if (result.recordset.length === 0) {
      return res.status(200).json([]); 
    }

    res.status(200).json(result.recordset);

  } catch (error) {
    console.error("Error en /api/pedidos/buscar:", error.message);
    res.status(500).json({ message: "Error interno del servidor SQL." });
  }
});

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
  console.log(`Servidor BD: ${process.env.DB_SERVER}:${process.env.DB_PORT}`);
  console.log(`Base de Datos: ${process.env.DB_DATABASE}`);
});