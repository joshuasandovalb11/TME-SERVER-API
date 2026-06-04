const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

const TEST_DEVICE_ID = 'UUID-TEST-BATCH-9999';
const TEST_VENDEDOR_ID = 'ARA';
const TEST_DATE = '2026-06-03';
const ENDPOINT_URL = 'http://localhost:3001/api/visualizador/rutas/moviles/batch';

async function runTest() {
  console.log('🚀 Iniciando prueba de Recepción de Telemetría Batch...\n');
  let pool;
  try {
    pool = await poolPromiseRutas;

    // ==========================================
    // SETUP: Crear dispositivo temporal activo
    // ==========================================
    console.log('--- SETUP: Preparando dispositivo falso ---');
    await pool.request()
      .input('deviceId', sql.VarChar(100), TEST_DEVICE_ID)
      .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dispositivos WHERE id_dispositivo = @deviceId)
        BEGIN
          INSERT INTO dispositivos (id_dispositivo, id_vendedor, modelo_dispositivo, estatus)
          VALUES (@deviceId, @idVendedor, 'Batch Test Device', 1)
        END
        ELSE
        BEGIN
          UPDATE dispositivos SET estatus = 1, id_vendedor = @idVendedor WHERE id_dispositivo = @deviceId
        END
      `);

    // Limpiar rutas previas para la prueba
    await pool.request()
      .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
      .input('fecha', sql.Date, TEST_DATE)
      .query(`DELETE FROM rutas_moviles_diarias WHERE id_vendedor = @idVendedor AND fecha = @fecha`);
      
    // ==========================================
    // PASO 1: Primer Payload Falso (INSERT)
    // ==========================================
    console.log('\n--- PASO 1: Primer envío (INSERT) ---');
    const payload1 = {
      deviceId: TEST_DEVICE_ID,
      date: TEST_DATE,
      columns: ["lat", "lng", "timestamp", "speed", "state"],
      events: [
        [32.5149, -117.0382, 1685732400, 45, 1], // timestamp 2
        [32.5150, -117.0380, 1685732460, 50, 1]  // timestamp 3
      ]
    };
    
    let res1 = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload1)
    });
    
    if (res1.ok) {
      console.log('✅ Primer payload insertado exitosamente (Status: 200).');
    } else {
      throw new Error(`Fallo en el primer insert: ${res1.status}`);
    }

    // ==========================================
    // PASO 2: Segundo Payload Falso (UPSERT)
    // ==========================================
    console.log('\n--- PASO 2: Segundo envío (UPSERT) ---');
    const payload2 = {
      deviceId: TEST_DEVICE_ID,
      date: TEST_DATE,
      columns: ["lat", "lng", "timestamp", "speed", "state"],
      events: [
        [32.5148, -117.0385, 1685732300, 40, 1], // timestamp 1 (antes de los anteriores)
        [32.5155, -117.0375, 1685732520, 55, 1]  // timestamp 4 (después de los anteriores)
      ]
    };

    let res2 = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload2)
    });

    if (res2.ok) {
      console.log('✅ Segundo payload actualizado exitosamente (Status: 200).');
    } else {
      throw new Error(`Fallo en el upsert: ${res2.status}`);
    }

    // ==========================================
    // PASO 3: Verificación en SQL Server
    // ==========================================
    console.log('\n--- PASO 3: Verificando fusión y orden cronológico en DB ---');
    const dbResult = await pool.request()
      .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
      .input('fecha', sql.Date, TEST_DATE)
      .query(`SELECT datos_ruta FROM rutas_moviles_diarias WHERE id_vendedor = @idVendedor AND fecha = @fecha`);

    if (dbResult.recordset.length === 0) {
      throw new Error('No se encontró el registro en la BD.');
    }

    const data = JSON.parse(dbResult.recordset[0].datos_ruta);
    const savedEvents = data.events;

    console.log(`Eventos guardados: ${savedEvents.length} (esperados: 4)`);
    if (savedEvents.length !== 4) {
      console.log('❌ Error: El número de eventos no es el esperado.');
    } else {
      // Verificar orden cronológico usando el índice del timestamp (índice 2)
      let ordenado = true;
      for (let i = 1; i < savedEvents.length; i++) {
        if (savedEvents[i - 1][2] > savedEvents[i][2]) { 
          ordenado = false;
          break;
        }
      }
      if (ordenado) {
        console.log('✅ Los eventos se fusionaron y están correctamente ordenados cronológicamente por timestamp.');
        console.log('Orden real de timestamps:', savedEvents.map(e => e[2]));
      } else {
        console.log('❌ Los eventos no están ordenados correctamente.');
        console.log('Timestamps encontrados:', savedEvents.map(e => e[2]));
      }
    }

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA PRUEBA:', error);
  } finally {
    // ==========================================
    // TEARDOWN: Limpieza de la BD
    // ==========================================
    console.log('\n--- LIMPIEZA ---');
    if (pool) {
      await pool.request()
        .input('deviceId', sql.VarChar(100), TEST_DEVICE_ID)
        .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
        .input('fecha', sql.Date, TEST_DATE)
        .query(`
          DELETE FROM rutas_moviles_diarias WHERE id_vendedor = @idVendedor AND fecha = @fecha;
          DELETE FROM dispositivos WHERE id_dispositivo = @deviceId;
        `);
      console.log('✅ Datos temporales de prueba limpiados de la base de datos.');
      sql.close();
    }
    console.log('\n🏁 Prueba finalizada.');
    process.exit(0);
  }
}

runTest();
