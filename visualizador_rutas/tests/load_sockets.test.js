const { io } = require('socket.io-client');
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

const numMobiles = parseInt(process.argv[2], 10) || 100;
const SOCKET_URL = 'http://localhost:3001';

console.log(`🚀 Iniciando Load Test con ${numMobiles} dispositivos móviles simulados...`);

const latencies = [];
let messagesReceived = 0;
const lastPingTimes = new Map();

let pool;
const setupDB = async () => {
  pool = await poolPromiseRutas;
  console.log('--- SETUP: Insertando dispositivos de prueba en BD ---');
  let values = [];
  for (let i = 0; i < numMobiles; i++) {
    values.push(`('TEST_MOBILE_${i}', 'ARA', 'Load Test Device', 1)`);
  }

  await pool.request().query(`
    -- Delete first just in case
    DELETE FROM estado_dispositivos WHERE id_dispositivo LIKE 'TEST_MOBILE_%';
    DELETE FROM dispositivos WHERE id_dispositivo LIKE 'TEST_MOBILE_%';
    
    INSERT INTO dispositivos (id_dispositivo, id_vendedor, modelo_dispositivo, estatus)
    VALUES ${values.join(',')}
  `);
  console.log('✅ Dispositivos de prueba insertados.');
};

const teardownDB = async () => {
  console.log('\n--- LIMPIEZA: Eliminando dispositivos de prueba ---');
  if (pool) {
    await pool.request().query(`
      DELETE FROM estado_dispositivos WHERE id_dispositivo LIKE 'TEST_MOBILE_%';
      DELETE FROM dispositivos WHERE id_dispositivo LIKE 'TEST_MOBILE_%';
    `);
    console.log('✅ Dispositivos de prueba eliminados.');
    sql.close();
  }
};

let dashboardSocket;

async function runTest() {
  await setupDB();

  dashboardSocket = io(SOCKET_URL);

  dashboardSocket.on('connect', () => {
    console.log('✅ Dashboard conectado.');
    connectMobiles();
  });

  dashboardSocket.on('dashboard_update', (data) => {
    if (data.id_dispositivo && lastPingTimes.has(data.id_dispositivo)) {
      const latency = Date.now() - lastPingTimes.get(data.id_dispositivo);
      latencies.push(latency);
      messagesReceived++;
    }
  });

  const mobileSockets = [];

  const connectMobiles = async () => {
    for (let i = 0; i < numMobiles; i++) {
      const socket = io(SOCKET_URL);
      mobileSockets.push(socket);

      setInterval(() => {
        const deviceId = `TEST_MOBILE_${i}`;
        lastPingTimes.set(deviceId, Date.now());
        socket.emit('ubicacion_tiempo_real', {
          d: deviceId,
          lt: 32.5 + Math.random() * 0.1,
          ln: -117.0 + Math.random() * 0.1,
          sp: Math.floor(Math.random() * 60),
          hd: 90
        });
      }, 3000);

      await new Promise(resolve => setTimeout(resolve, 50));
    }
    console.log(`✅ ${numMobiles} Móviles conectados y emitiendo pings.`);
  };

  const totalTestTime = 20000 + (numMobiles * 50);
  setTimeout(() => {
    console.log('\n--- ⏱️ Resultados de la Prueba ---');
    console.log(`Total de mensajes recibidos: ${messagesReceived}`);

    if (latencies.length > 0) {
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const min = Math.min(...latencies);
      const max = Math.max(...latencies);

      console.log(`Latencia Promedio: ${avg.toFixed(2)} ms`);
      console.log(`Latencia Mínima: ${min} ms`);
      console.log(`Latencia Máxima: ${max} ms`);

      if (avg < 100) {
        console.log('✅ ÉXITO: Latencia promedio menor a 100ms.');
      } else {
        console.log('❌ FALLO: Latencia promedio supera los 100ms.');
      }
    } else {
      console.log('❌ FALLO: No se recibieron mensajes en el dashboard.');
    }

    dashboardSocket.disconnect();
    mobileSockets.forEach(s => s.disconnect());

    teardownDB().then(() => {
      process.exit(0);
    });
  }, totalTestTime);
}

runTest();
