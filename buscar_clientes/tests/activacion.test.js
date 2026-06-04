const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

// Configuración de la prueba
// NOTA: Si el vendedor con ID 1 no existe en tu BD, cambia este valor por un ID válido.
const TEST_VENDEDOR_ID = 'ARA'; 
const TEST_PIN = '123456';
const TEST_DEVICE_ID = 'TEST_DEVICE_XYZ_123';
const TEST_DEVICE_MODEL = 'iPhone 15 Test';
const ENDPOINT_URL = 'http://localhost:3001/api/dispositivos/activar';

async function runTest() {
  console.log('🚀 Iniciando prueba end-to-end de Activación de Dispositivo...\n');
  let pool;
  try {
    pool = await poolPromiseRutas;

    // ==========================================
    // PASO A: Preparación de Datos
    // ==========================================
    console.log('--- PASO A: Preparación de Datos ---');
    await pool.request()
      .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
      .input('pin', sql.VarChar(50), TEST_PIN)
      .query(`
        UPDATE vendedores 
        SET pin_activacion_movil = @pin, 
            expiracion_pin = DATEADD(day, 1, GETDATE()) 
        WHERE id_vendedor = @idVendedor
      `);
    console.log(`✅ Vendedor ${TEST_VENDEDOR_ID} actualizado con PIN '${TEST_PIN}' y expiración para mañana.\n`);

    // ==========================================
    // PASO B: Simulación de Petición HTTP
    // ==========================================
    console.log('--- PASO B: Petición HTTP al Endpoint ---');
    const bodyPayload = {
      idVendedor: TEST_VENDEDOR_ID,
      pin: TEST_PIN,
      idDispositivo: TEST_DEVICE_ID,
      modeloDispositivo: TEST_DEVICE_MODEL
    };

    console.log(`Enviando POST a ${ENDPOINT_URL}`);
    console.log('Body:', bodyPayload);
    
    // Usamos el fetch nativo de Node.js (v18+)
    const response = await fetch(ENDPOINT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bodyPayload)
    });

    const data = await response.json();
    
    if (response.ok) {
      console.log(`✅ Petición exitosa (Status: ${response.status}). Respuesta:`, data);
    } else {
      console.log(`❌ Petición fallida (Status: ${response.status}). Respuesta:`, data);
      throw new Error(`El endpoint respondió con error: ${response.status}`);
    }
    console.log('');

    // ==========================================
    // PASO C: Verificación en Base de Datos
    // ==========================================
    console.log('--- PASO C: Verificación en Base de Datos ---');
    
    // Verificar que el PIN se quemó (se volvió NULL)
    const resultVendedor = await pool.request()
      .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
      .query(`
        SELECT pin_activacion_movil 
        FROM vendedores 
        WHERE id_vendedor = @idVendedor
      `);
    
    if (resultVendedor.recordset.length > 0 && resultVendedor.recordset[0].pin_activacion_movil === null) {
      console.log('✅ El PIN de activación fue consumido correctamente (ahora es NULL).');
    } else {
      console.log('❌ El PIN no se limpió correctamente en la tabla vendedores.');
    }

    // Verificar que el dispositivo se insertó y está activo
    const resultDispositivo = await pool.request()
      .input('idVendedor', sql.VarChar(50), TEST_VENDEDOR_ID)
      .input('idDispositivo', sql.VarChar(100), TEST_DEVICE_ID)
      .query(`
        SELECT id_dispositivo, modelo_dispositivo, estatus 
        FROM dispositivos 
        WHERE id_vendedor = @idVendedor AND id_dispositivo = @idDispositivo
      `);

    if (resultDispositivo.recordset.length > 0) {
      const device = resultDispositivo.recordset[0];
      if (device.estatus === 1 || device.estatus === true) {
        console.log(`✅ Dispositivo '${device.id_dispositivo}' guardado correctamente con estatus activo.`);
      } else {
        console.log('❌ Dispositivo encontrado pero con estatus incorrecto:', device);
      }
    } else {
      console.log('❌ No se encontró el dispositivo en la base de datos tras la activación.');
    }

  } catch (error) {
    console.error('\n❌ ERROR DURANTE LA PRUEBA:', error.message || error);
  } finally {
    console.log('\n🏁 Prueba finalizada.');
    if (pool) {
      sql.close(); // Cerramos la conexión a la base de datos para que el script pueda terminar
    }
    process.exit(0);
  }
}

runTest();
