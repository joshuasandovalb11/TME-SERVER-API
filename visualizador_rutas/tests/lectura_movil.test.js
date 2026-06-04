const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

async function runTest() {
  console.log('🚀 Iniciando prueba de Lectura de Telemetría Móvil (Endpoint GET)...\n');
  let pool;
  try {
    pool = await poolPromiseRutas;

    // ==========================================
    // SETUP: Insertando ruta falsa en BD
    // ==========================================
    console.log('--- SETUP: Insertando ruta falsa ---');
    
    await pool.request()
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dispositivos WHERE id_dispositivo = 'TEST_DEV')
        BEGIN
          INSERT INTO dispositivos (id_dispositivo, id_vendedor, modelo_dispositivo, estatus)
          VALUES ('TEST_DEV', 'ARA', 'Test Device', 1)
        END
      `);

    const dummyJson = JSON.stringify({
      events: [
        [32.5149, -117.0382, 1685732400, 45, 1], // 2023-06-02 12:00:00 GMT-7
        [32.5150, -117.0380, 1685732460, 50, 1]  // 2023-06-02 12:01:00 GMT-7
      ]
    });

    const insertResult = await pool.request()
      .input('datos_ruta', sql.NVarChar(sql.MAX), dummyJson)
      .query(`
        INSERT INTO rutas_moviles_diarias (id_dispositivo, id_vendedor, fecha, datos_ruta, fecha_sincronizacion)
        OUTPUT INSERTED.id_ruta_movil
        VALUES ('TEST_DEV', 'ARA', '2026-06-03', @datos_ruta, GETDATE())
      `);
      
    const insertedId = insertResult.recordset[0].id_ruta_movil;
    console.log(`✅ Ruta falsa insertada con ID: ${insertedId}`);

    // ==========================================
    // PASO 1: Petición HTTP al Endpoint
    // ==========================================
    console.log(`\n--- PASO 1: Consumiendo Endpoint HTTP GET ---`);
    const res = await fetch(`http://localhost:3001/api/visualizador/rutas/moviles/${insertedId}`);
    
    if (!res.ok) {
      throw new Error(`El endpoint respondió con error: ${res.status}`);
    }
    
    const data = await res.json();
    console.log('✅ Petición exitosa (Status: 200).');
    
    // ==========================================
    // PASO 2: Verificando Contrato ProcessedTripV1
    // ==========================================
    console.log('\n--- PASO 2: Verificando Contrato ProcessedTripV1 ---');
    let pasaronChecks = true;
    
    if (data.source !== 'mobile-device') {
      console.log('❌ Error: El payload.source no es "mobile-device". Valor actual:', data.source);
      pasaronChecks = false;
    }
    if (data.vehiculo !== 'Móvil') {
      console.log('❌ Error: El vehiculo no es "Móvil". Valor actual:', data.vehiculo);
      pasaronChecks = false;
    }
    if (!Array.isArray(data.events) || data.events.length !== 2) {
      console.log('❌ Error: Los eventos no se inflaron/mapearon correctamente. Cantidad:', data.events ? data.events.length : 'N/A');
      pasaronChecks = false;
    }
    
    // Verificar mapeo interno de horas
    if (data.events && data.events[0]) {
      const hora = data.events[0].time;
      console.log(`⏱️ Hora mapeada del primer evento (Local Tijuana): ${hora}`);
      if (!hora) {
        console.log('❌ Error: El atributo "time" (proveniente del adaptador) no está presente.');
        pasaronChecks = false;
      }
    }
    
    if (data.summary && data.summary.isTripOngoing !== undefined) {
      console.log(`✅ Summary generado correctamente (isTripOngoing: ${data.summary.isTripOngoing})`);
    } else {
      console.log('❌ Error: Summary faltante en el payload.');
      pasaronChecks = false;
    }

    if (pasaronChecks) {
      console.log('\n✅ El payload cumple con la estructura estricta requerida (ProcessedTripV1).');
    } else {
      console.log('\n❌ Fallaron validaciones del contrato de datos.');
    }

    // ==========================================
    // TEARDOWN: Limpieza
    // ==========================================
    console.log('\n--- LIMPIEZA ---');
    await pool.request()
      .input('id', sql.Int, insertedId)
      .query(`
        DELETE FROM rutas_moviles_diarias WHERE id_ruta_movil = @id;
        DELETE FROM dispositivos WHERE id_dispositivo = 'TEST_DEV';
      `);
    console.log('✅ Ruta de prueba eliminada de la base de datos.');

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA PRUEBA:', error);
  } finally {
    if (pool) sql.close();
    console.log('\n🏁 Prueba finalizada.');
    process.exit(0);
  }
}

runTest();
