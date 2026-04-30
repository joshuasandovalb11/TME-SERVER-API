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
 * Endpoint para la App Móvil (Búsqueda por ID exacto)
 */
app.get("/api/clientes/app-search", async (req, res) => {
  const { id } = req.query;

  console.log(`[API SQL] 🔍 Iniciando búsqueda para App Móvil. ID Cliente: ${id}`);

  if (!id) return res.status(400).json({ message: "Falta el ID del cliente" });

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('clienteId', sql.Int, id);

    const result = await request.query(`
      SELECT 
        c.ClienteID, 
        c.NombreCliente, 
        c.GPS, 
        c.SucursalID, 
        c.SucursalNombre,
        c.Vend,
        v.Nombre as VendedorNombre,
        v.Telefono as VendedorTelefono
      FROM Clientes c WITH (NOLOCK)
      LEFT JOIN Vendedores v WITH (NOLOCK)
      ON LTRIM(RTRIM(c.Vend)) = LTRIM(RTRIM(v.Iniciales))
      WHERE c.ClienteID = @clienteId
    `);

    console.log(`✅ Búsqueda finalizada. Registros encontrados: ${result.recordset.length}`);

    const sucursales = result.recordset.map(row => {
        const gpsParts = row.GPS ? row.GPS.split(',') : [];
        let lat = null;
        let lng = null;

        if (gpsParts.length === 2) {
            const tempLat = parseFloat(gpsParts[0].trim());
            const tempLng = parseFloat(gpsParts[1].trim());
            
            if (tempLat !== 0 || tempLng !== 0) {
                lat = tempLat;
                lng = tempLng;
            }
        }

        return {
            id: String(row.ClienteID).trim(),
            nombre: (row.NombreCliente || 'N/A').trim(),
            latitud: lat,
            longitud: lng,
            numeroSucursal: row.SucursalID ? String(row.SucursalID).trim() : "0",
            nombreSucursal: (row.SucursalNombre || "").trim(),
            vendedorCodigo: (row.Vend || '').trim(),
            vendedorNombre: (row.VendedorNombre || 'No asignado').trim(),
            vendedorTelefono: (row.VendedorTelefono || '').trim()
        };
    });

    res.status(200).json(sucursales);

  } catch (error) {
    console.error("❌ Error en app-search:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
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

// ENDPOINT OBTENER VENDEDORES ÚNICOS
app.get("/api/vendedores", async (req, res) => {
  console.log('[API] Solicitando lista de vendedores...');
  try {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT DISTINCT LTRIM(RTRIM(Vend)) as Vend
      FROM Clientes
      WHERE Vend IS NOT NULL AND LTRIM(RTRIM(Vend)) <> ''
      ORDER BY Vend ASC
    `);

    const listaVendedores = result.recordset.map(row => row.Vend);
    console.log(`✅ Vendedores encontrados: ${listaVendedores.length}`);
    res.status(200).json(listaVendedores);

  } catch (error) {
    console.error("❌ Error cargando vendedores:", error.message);
    res.status(500).json([]);
  }
});

// ENDPOINT PARA SUPERVISORES
app.get("/api/clientes/vendedor/:vend", async (req, res) => {
  const vendedorSeleccionado = req.params.vend;
  console.log(`[SQL API] Solicitando clientes para el vendedor: ${vendedorSeleccionado}`);

  try {
    const pool = await poolPromise;
    const request = pool.request();
    
    request.input('vend', sql.VarChar, vendedorSeleccionado);

    const result = await request.query(`
      SELECT ClienteID, NombreCliente, GPS, SucursalID, SucursalNombre
      FROM Clientes
      WHERE LTRIM(RTRIM(Vend)) = LTRIM(RTRIM(@vend))
        AND GPS IS NOT NULL 
        AND GPS LIKE '%,%'
    `);

    const clientesProcesados = result.recordset.map(row => {
        const gpsParts = row.GPS ? row.GPS.split(',') : [];
        let lat = 0, lng = 0;
        if (gpsParts.length === 2) {
            lat = parseFloat(gpsParts[0].trim());
            lng = parseFloat(gpsParts[1].trim());
        }

        return {
            id: String(row.ClienteID).trim(),
            nombre: (row.NombreCliente || '').trim(),
            latitud: lat,
            longitud: lng,
            numeroSucursal: row.SucursalID ? String(row.SucursalID).trim() : "0",
            nombreSucursal: row.SucursalNombre ? row.SucursalNombre.trim() : ""
        };
    }).filter(c => c.latitud !== 0 && c.longitud !== 0);

    console.log(`✅ Se enviarán ${clientesProcesados.length} clientes del vendedor ${vendedorSeleccionado}.`);
    res.status(200).json(clientesProcesados);

  } catch (error) {
    console.error("❌ Error buscando clientes del vendedor:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
  }
});

// ==========================================
// ENDPOINTS DE VISITAS DE SUPERVISORES
// ==========================================

// Obtener clientes visitados por un dispositivo
app.get("/api/visitas/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[SQL Server] Solicitando visitas para DeviceID: ${deviceId}`);

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('deviceId', sql.VarChar, deviceId);

    const result = await request.query(`
      SELECT ClienteID, SucursalID 
      FROM VisitasSupervisores 
      WHERE DeviceID = @deviceId
    `);

    const visitados = result.recordset.map(row => `${row.ClienteID}-${row.SucursalID || 0}`);
    
    res.status(200).json(visitados);
  } catch (error) {
    console.error("❌ Error obteniendo visitas:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
  }
});

// Alternar (Marcar/Desmarcar) visita desde la tarjeta
app.post("/api/visitas/toggle", async (req, res) => {
  const { deviceId, clienteId, sucursalId, sucursalNombre } = req.body;
  
  if (!deviceId || !clienteId) {
    return res.status(400).json({ message: "Faltan datos obligatorios." });
  }

  const sucId = sucursalId ? parseInt(sucursalId) : 0;
  const sucNombre = sucursalNombre || "";

  console.log(`[SQL Server] Registrando visita -> Device: ${deviceId}, Cliente: ${clienteId}, Suc: ${sucId}`);

  try {
    const pool = await poolPromise;
    const request = pool.request();
    
    request.input('deviceId', sql.VarChar, deviceId);
    request.input('clienteId', sql.Int, parseInt(clienteId));
    request.input('sucursalId', sql.Int, sucId);
    request.input('sucursalNombre', sql.VarChar, sucNombre);

    const check = await request.query(`
      SELECT ID FROM VisitasSupervisores 
      WHERE DeviceID = @deviceId AND ClienteID = @clienteId AND SucursalID = @sucursalId
    `);

    if (check.recordset.length > 0) {
      res.status(200).json({ visitado: true, message: "El cliente ya estaba visitado previamente." });
    } else {
      await request.query(`
        INSERT INTO VisitasSupervisores (DeviceID, ClienteID, SucursalID, SucursalNombre, FechaVisita)
        VALUES (@deviceId, @clienteId, @sucursalId, @sucursalNombre, CAST(SYSDATETIMEOFFSET() AT TIME ZONE 'Pacific Standard Time' AS DATETIME))
      `);
      res.status(200).json({ visitado: true, message: "Visita guardada correctamente con hora local." });
    }
  } catch (error) {
    console.error("❌ Error registrando visita:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
  }
});

// Obtener el historial completo con fechas, nombres de cliente y vendedor
app.get("/api/visitas/historial/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[SQL Server] Solicitando historial detallado para DeviceID: ${deviceId}`);

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('deviceId', sql.VarChar, deviceId);

    const result = await request.query(`
      SELECT 
        v.ClienteID, 
        v.SucursalID, 
        v.SucursalNombre, 
        v.FechaVisita,
        MAX(c.NombreCliente) as NombreCliente,
        MAX(c.Vend) as Vendedor
      FROM VisitasSupervisores v
      LEFT JOIN Clientes c 
        ON v.ClienteID = c.ClienteID 
        AND ISNULL(v.SucursalID, 0) = ISNULL(c.SucursalID, 0)
      WHERE v.DeviceID = @deviceId
      GROUP BY v.ClienteID, v.SucursalID, v.SucursalNombre, v.FechaVisita
      ORDER BY v.FechaVisita DESC
    `);

    res.status(200).json(result.recordset);
  } catch (error) {
    console.error("❌ Error obteniendo historial:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
  }
});

// Resetear (Borrar) todas las visitas de un dispositivo
app.delete("/api/visitas/reset/:deviceId", async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[SQL Server] 🔥 RESET de visitas para DeviceID: ${deviceId}`);

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('deviceId', sql.VarChar, deviceId);

    await request.query(`
      DELETE FROM VisitasSupervisores 
      WHERE DeviceID = @deviceId
    `);

    res.status(200).json({ message: "Historial borrado correctamente." });
  } catch (error) {
    console.error("❌ Error reseteando visitas:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
  }
});

// ==========================================
// ENDPOINT DE CREDENCIALES (SEGURIDAD)
// ==========================================
app.get("/api/credenciales/:tipo", async (req, res) => {
  const { tipo } = req.params;
  console.log(`[SQL Server] Solicitando credencial tipo: ${tipo}`);

  try {
    const pool = await poolPromise;
    const request = pool.request();
    request.input('tipo', sql.VarChar, tipo);

    const result = await request.query(`
      SELECT Valor FROM Credenciales WHERE Tipo = @tipo
    `);

    if (result.recordset.length > 0) {
      res.status(200).json({ pin: result.recordset[0].Valor });
    } else {
      res.status(404).json({ message: "Credencial no encontrada" });
    }
  } catch (error) {
    console.error("❌ Error obteniendo credencial:", error.message);
    res.status(500).json({ message: "Error interno SQL" });
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