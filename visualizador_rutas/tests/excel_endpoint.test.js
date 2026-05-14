// visualizador_rutas/tests/excel_endpoint.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const FormData = require('form-data');
const http = require('node:http');

/**
 * Test para validar que el endpoint POST /api/visualizador/rutas/excel
 * procesa un archivo Excel y devuelve la estructura v1 limpia
 * 
 * NOTA: Para ejecutar este test, necesitas:
 * 1. El servidor backend corriendo en http://localhost:3001
 * 2. Un archivo Excel válido en ../../../temp_uploads/ (o proporcionar ruta correcta)
 */

async function testExcelEndpoint() {
  // Buscar un archivo Excel de prueba
  const excelPath = path.join(__dirname, '../../../temp_uploads/test_route.xlsx');
  
  if (!fs.existsSync(excelPath)) {
    console.warn('⚠️  No se encontró archivo Excel de prueba en:', excelPath);
    console.log('ℹ️  Para ejecutar este test, coloca un archivo Excel válido en temp_uploads/');
    return;
  }

  const formData = new FormData();
  formData.append('archivoExcel', fs.createReadStream(excelPath));

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/visualizador/rutas/excel?incluirClientes=true&minStopDuration=5',
      method: 'POST',
      headers: formData.getHeaders()
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const payload = JSON.parse(data);

          if (res.statusCode !== 200) {
            console.error('❌ Error en respuesta:', payload);
            reject(new Error(`HTTP ${res.statusCode}: ${payload.error}`));
            return;
          }

          // Validar estructura v1
          assert.ok(typeof payload.idRuta === 'number' || payload.idRuta === null, 'idRuta debe ser number o null');
          assert.equal(typeof payload.fecha, 'string');
          assert.equal(typeof payload.vendedor, 'string');
          assert.equal(typeof payload.nombreVendedor, 'string');
          assert.equal(typeof payload.vehiculo, 'string');
          assert.ok(Array.isArray(payload.events));
          assert.ok(Array.isArray(payload.path));
          assert.ok(Array.isArray(payload.flags));
          assert.ok(payload.summary && typeof payload.summary === 'object');
          assert.ok(Array.isArray(payload.clients));
          assert.equal(payload.source, 'excel-file');

          console.log('✅ Test Excel endpoint PASSED');
          console.log(`   - Vehículo: ${payload.vehiculo} (${payload.vendedor})`);
          console.log(`   - Fecha: ${payload.fecha}`);
          console.log(`   - Eventos: ${payload.events.length}`);
          console.log(`   - Puntos de ruta: ${payload.path.length}`);
          console.log(`   - Flags: ${payload.flags.length}`);
          console.log(`   - Clientes: ${payload.clients.length}`);
          console.log(`   - Distancia: ${payload.summary.totalDistanceKm} km`);

          resolve(true);
        } catch (error) {
          reject(error);
        }
      });
    });

    req.on('error', reject);
    formData.pipe(req);
  });
}

async function run() {
  try {
    await testExcelEndpoint();
  } catch (error) {
    console.error('ERROR en test Excel:', error.message);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  run();
}

module.exports = { testExcelEndpoint };
