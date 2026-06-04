const { io } = require('socket.io-client');
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

const numMobiles = parseInt(process.argv[2], 10) || 1;
const SOCKET_URL = 'http://localhost:3002';

console.log(`🚀 Iniciando Load Test con ${numMobiles} dispositivos móviles simulados...`);

const latencies = [];
let messagesReceived = 0;

let pool;
const setupDB = async () => {
  pool = await poolPromiseRutas;
  console.log('--- SETUP: Insertando dispositivos de prueba en BD ---');
  let values = [];
  for (let i = 0; i < numMobiles; i++) {
    values.push(`('TEST_MOBILE_${i}', 'ARA', 'Load Test Device', 1)`);
  }

  // Insert in batches if needed, but 400 is fine in a single query
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

// 1. Instanciar Dashboard
const dashboardSocket = io(SOCKET_URL);

async function runTest() {
  await setupDB();

  dashboardSocket.on('connect', () => {
    console.log('✅ Dashboard conectado.');
  });

dashboardSocket.on('dashboard_update', (data) => {
  if (data.emitTime) {
    const latency = Date.now() - data.emitTime;
    latencies.push(latency);
    messagesReceived++;
  }
});

// 2. Instanciar sockets "Móviles" con retraso escalonado
const mobileSockets = [];

const connectMobiles = async () => {
  for (let i = 0; i < numMobiles; i++) {
    const socket = io(SOCKET_URL);
    mobileSockets.push(socket);
    
    // Iniciar ping cada 3 segundos
    setInterval(() => {
      socket.emit('mobile_ping', {
        id_dispositivo: `TEST_MOBILE_${i}`,
        id_vendedor: `ARA`,
        latitud: 32.5 + Math.random() * 0.1,
        longitud: -117.0 + Math.random() * 0.1,
        velocidad: Math.floor(Math.random() * 60),
        estado_actividad: 'En movimiento',
        nivel_bateria: 100,
        emitTime: Date.now()
      });
    }, 3000);

    // Retraso de 50ms para no saturar el SO localmente
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  console.log(`✅ ${numMobiles} Móviles conectados y emitiendo pings.`);
};

dashboardSocket.on('connect', () => {
  connectMobiles();
});

// 3. Finalizar prueba
const totalTestTime = 20000 + (numMobiles * 50); // 20 segs + tiempo de instanciación
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

  // Cerrar sockets para terminar proceso
  dashboardSocket.disconnect();
  mobileSockets.forEach(s => s.disconnect());
  
  teardownDB().then(() => {
    process.exit(0);
  });
}, totalTestTime);
}

runTest();
