// visualizador_rutas/services/realtime.service.js
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

let locationBuffer = new Map();
const deviceSellerCache = new Map();
const resolvingDevices = new Set();

const resolveSellerId = async (deviceId) => {
  if (resolvingDevices.has(deviceId)) return;
  resolvingDevices.add(deviceId);

  try {
    const pool = await poolPromiseRutas;
    const result = await pool.request()
      .input('deviceId', sql.VarChar(100), deviceId)
      .query(`SELECT id_vendedor FROM dispositivos WHERE id_dispositivo = @deviceId AND estatus = 1`);

    if (result.recordset.length > 0 && result.recordset[0].id_vendedor) {
      deviceSellerCache.set(deviceId, result.recordset[0].id_vendedor);
      console.log(`✅ Vendedor resuelto en caché: ${deviceId} -> ${result.recordset[0].id_vendedor}`);
    } else {
      console.warn(`⚠️ Dispositivo no encontrado o inactivo: ${deviceId}`);
    }
  } catch (error) {
    console.error(`❌ Error al resolver id_vendedor para el dispositivo ${deviceId}:`, error.message);
  } finally {
    resolvingDevices.delete(deviceId);
  }
};

const updateLocationInBuffer = (data) => {
  if (!data || !data.d) return null;

  const sellerId = deviceSellerCache.get(data.d);

  if (!sellerId) {
    resolveSellerId(data.d);
    return null;
  }

  const expandedLocation = {
    id_dispositivo: data.d,
    id_vendedor: sellerId,
    latitud: data.lt,
    longitud: data.ln,
    velocidad: data.sp || 0,
    estado_actividad: 'ACTIVO',
    nivel_bateria: 100
  };

  locationBuffer.set(expandedLocation.id_dispositivo, expandedLocation);

  return expandedLocation;
};

let flushCounter = 0;
const flushBufferToDB = async () => {
  if (locationBuffer.size === 0) return;

  const currentBuffer = locationBuffer;
  locationBuffer = new Map();
  const locations = Array.from(currentBuffer.values());

  const flushId = ++flushCounter;
  const timeLabel = `DB_FLUSH_TIME_${flushId}`;

  try {
    const jsonBuffer = JSON.stringify(locations);
    const pool = await poolPromiseRutas;

    console.time(timeLabel);
    await pool.request()
      .input('jsonBuffer', sql.NVarChar(sql.MAX), jsonBuffer)
      .query(`
        MERGE INTO estado_dispositivos AS target
        USING (
          SELECT 
            id_dispositivo, 
            id_vendedor, 
            latitud, 
            longitud, 
            velocidad, 
            estado_actividad, 
            nivel_bateria 
          FROM OPENJSON(@jsonBuffer)
          WITH (
            id_dispositivo VARCHAR(100),
            id_vendedor VARCHAR(50),
            latitud FLOAT,
            longitud FLOAT,
            velocidad INT,
            estado_actividad VARCHAR(50),
            nivel_bateria INT
          )
        ) AS source
        ON target.id_dispositivo = source.id_dispositivo
        WHEN MATCHED THEN 
          UPDATE SET 
            target.latitud = source.latitud,
            target.longitud = source.longitud,
            target.velocidad = source.velocidad,
            target.estado_actividad = source.estado_actividad,
            target.nivel_bateria = source.nivel_bateria,
            target.ultima_actualizacion = GETDATE()
        WHEN NOT MATCHED THEN 
          INSERT (
            id_dispositivo, 
            id_vendedor, 
            latitud, 
            longitud, 
            velocidad, 
            estado_actividad, 
            nivel_bateria, 
            ultima_actualizacion
          ) 
          VALUES (
            source.id_dispositivo, 
            source.id_vendedor, 
            source.latitud, 
            source.longitud, 
            source.velocidad, 
            source.estado_actividad, 
            source.nivel_bateria, 
            GETDATE()
          );
      `);
    console.timeEnd(timeLabel);

  } catch (error) {
    console.error('❌ Error en flushBufferToDB masivo:', error.message || error);
  }
};

const startDBFlushCron = () => {
  setInterval(flushBufferToDB, 15000);
  console.log('✅ Cron job (Buffer to DB Masivo) iniciado cada 15s');
};

module.exports = {
  updateLocationInBuffer,
  startDBFlushCron
};
