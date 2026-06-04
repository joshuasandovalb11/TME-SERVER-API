const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');

let locationBuffer = new Map();

const updateLocationInBuffer = (data) => {
  if (!data || !data.id_dispositivo) return;
  locationBuffer.set(data.id_dispositivo, data);
};

let flushCounter = 0;
const flushBufferToDB = async () => {
  if (locationBuffer.size === 0) return;

  const currentBuffer = locationBuffer;
  locationBuffer = new Map(); // Swap inmediately (Thread-safe swap in Node.js)
  const locations = Array.from(currentBuffer.values());

  const flushId = ++flushCounter;
  const timeLabel = `DB_FLUSH_TIME_${flushId}`;
  
  try {
    const jsonBuffer = JSON.stringify(locations);
    const pool = await poolPromiseRutas;

    console.time(timeLabel);
    // OPENJSON combinado con MERGE (UPSERT masivo)
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
    // Evitamos matar el proceso si hay error de red
    console.error('❌ Error en flushBufferToDB masivo:', error.message || error);
  }
};

const startDBFlushCron = () => {
  setInterval(flushBufferToDB, 15000); // 15 segundos
  console.log('✅ Cron job (Buffer to DB Masivo) iniciado cada 15s');
};

module.exports = {
  updateLocationInBuffer,
  startDBFlushCron
};
