// visualizador_rutas/services/behavior.service.js
const { sql, poolPromiseRutas } = require('../../sistema_rutas/db_rutas');
const { fetchClientesByVendedor } = require('./rutas.service');
const { parseRawEventsJson, buildProcessedTripPayload } = require('./ruta_mapper');

const Holidays = require('date-holidays');
const hd = new Holidays('MX');

const parseToMins = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
};

const WORK_START_MIN = 510; // 8:30 AM
const WORK_END_MIN = 1050;  // 5:30 PM
// const WORK_END_MIN = 1140; // 7:00 PM

async function getBehaviorAnalytics(req, res) {
  const vendedorId = req.query.vendedor;
  const startDate = req.query.startDate;
  const endDate = req.query.endDate;
  const minStopDuration = Number(req.query.minStopDuration || 5);

  if (!vendedorId || !startDate || !endDate) {
    return res.status(400).json({ error: 'Faltan parámetros: vendedor, startDate, endDate' });
  }

  try {
    const clientes = await fetchClientesByVendedor(vendedorId);
    const pool = await poolPromiseRutas;

    const resultRutas = await pool.request()
      .input('vendedor', sql.VarChar(50), vendedorId)
      .input('startDate', sql.Date, startDate)
      .input('endDate', sql.Date, endDate)
      .query(`
        SELECT
          rd.id_ruta_diaria,
          CAST(rd.fecha AS DATE) AS fecha,
          COALESCE(vend.id_vendedor, rd.id_vendedor) AS id_vendedor,
          vend.nombre AS nombre_vendedor,
          v.placa,
          v.descripcion AS vehiculo,
          CAST(DECOMPRESS(rd.datos_ruta) AS VARCHAR(MAX)) AS datos_ruta
        FROM rutas_diarias rd
        INNER JOIN vehiculos v ON v.id_vehiculo = rd.id_vehiculo
        LEFT JOIN vendedores vend ON vend.id_vendedor = v.id_vendedor
        WHERE (COALESCE(vend.id_vendedor, rd.id_vendedor) = @vendedor)
          AND CAST(rd.fecha AS DATE) >= @startDate
          AND CAST(rd.fecha AS DATE) <= @endDate
        ORDER BY rd.fecha ASC
      `);

    const rutasRows = resultRutas.recordset;

    if (rutasRows.length === 0) {
      return res.status(200).json({ globalSummary: null, dailyBreakdown: [] });
    }

    const dailyBreakdown = [];
    const globalSummary = {
      diasTrabajados: 0,
      distanciaTotalKm: 0,
      clientesUnicosVisitados: new Set(),
      totalParadas: 0,
      tiempos: {
        productivo: { laboral: 0, extra: 0 },
        noProductivo: { laboral: 0, extra: 0 },
        casa: { laboral: 0, extra: 0 },
        tools: { laboral: 0, extra: 0 },
        traslados: { laboral: 0, extra: 0 }
      }
    };

    for (const row of rutasRows) {
      const fechaObj = new Date(row.fecha);
      const diaSemana = fechaObj.getUTCDay(); 
      if (diaSemana === 0 || diaSemana === 6) continue;

      const year = fechaObj.getUTCFullYear();
      const month = String(fechaObj.getUTCMonth() + 1).padStart(2, '0');
      const day = String(fechaObj.getUTCDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const festivosDelAno = hd.getHolidays(year);
      const festivoOficial = festivosDelAno.find(festivo => festivo.date.startsWith(dateString) && festivo.type === 'public');
      if (festivoOficial) continue;

      const resultViajes = await pool.request()
        .input('id', sql.Int, row.id_ruta_diaria)
        .query(`SELECT hora_inicio, latitud_inicio, longitud_inicio, hora_fin, latitud_final, longitud_final FROM viajes WHERE id_ruta_diaria = @id ORDER BY hora_inicio ASC`);

      const rawEvents = parseRawEventsJson(row.datos_ruta);

      const processedTrip = buildProcessedTripPayload({
        row, viajesAnaliticos: resultViajes.recordset, rawEvents, minStopDuration, clientes
      });

      const stops = processedTrip.flags.filter(f => f.type === 'stop');
      
      let timeClients = 0, timeClientsExtra = 0;
      let timeNonClients = 0, timeNonClientsExtra = 0;
      let timeHome = 0, timeHomeExtra = 0;
      let timeTools = 0, timeToolsExtra = 0;

      let stopLaboralTotal = 0, stopExtraTotal = 0;
      let dailyUniqueClients = new Set();

      stops.forEach(stop => {
        const isTools = ['3689', '6395'].includes(String(stop.clientKey));
        const dur = stop.durationMin || 0;
        const startMins = parseToMins(stop.time);
        const endMins = startMins + dur;

        let durLaboral = Math.max(0, Math.min(endMins, WORK_END_MIN) - Math.max(startMins, WORK_START_MIN));
        let durExtra = dur - durLaboral;

        durLaboral = Math.round(durLaboral);
        durExtra = Math.round(durExtra);

        stopLaboralTotal += durLaboral;
        stopExtraTotal += durExtra;

        if (stop.isVendorHome) {
          timeHome += durLaboral; timeHomeExtra += durExtra;
        } else if (isTools) {
          timeTools += durLaboral; timeToolsExtra += durExtra;
        } else if (stop.clientKey && stop.clientName !== 'Sin coincidencia') {
          timeClients += durLaboral; timeClientsExtra += durExtra;
          dailyUniqueClients.add(stop.clientKey);
          globalSummary.clientesUnicosVisitados.add(stop.clientKey);
        } else {
          timeNonClients += durLaboral; timeNonClientsExtra += durExtra;
        }
      });

      const startFlags = processedTrip.flags.filter(f => f.type === 'trip_start');
      const endFlags = processedTrip.flags.filter(f => f.type === 'trip_end');

      const startTripStr = startFlags.length > 0 ? startFlags[0].time : processedTrip.summary.workStartTime;
      const endTripStr = endFlags.length > 0 ? endFlags[endFlags.length - 1].time : processedTrip.summary.workEndTime;

      const startTripMins = parseToMins(startTripStr);
      const endTripMins = parseToMins(endTripStr);

      let totalTripLaboral = 0;
      let totalTripExtra = 0;

      if (endTripMins >= startTripMins) {
        totalTripLaboral = Math.max(0, Math.min(endTripMins, WORK_END_MIN) - Math.max(startTripMins, WORK_START_MIN));
        totalTripExtra = (endTripMins - startTripMins) - totalTripLaboral;
      } else {
        totalTripLaboral = Math.max(0, WORK_END_MIN - Math.max(startTripMins, WORK_START_MIN)) + Math.max(0, Math.min(endTripMins, WORK_END_MIN) - WORK_START_MIN);
        totalTripExtra = (1440 - startTripMins + endTripMins) - totalTripLaboral;
      }

      let timeTraslados = Math.max(0, Math.round(totalTripLaboral) - stopLaboralTotal);
      let timeTrasladosExtra = Math.max(0, Math.round(totalTripExtra) - stopExtraTotal);

      if (endFlags.length > 0 && endTripMins >= WORK_START_MIN && endTripMins < WORK_END_MIN) {
        const gapMinutos = Math.round(WORK_END_MIN - endTripMins);

        if (gapMinutos > 0) {
          const getDist = (lat1, lon1, lat2, lon2) => {
            const p1 = lat1 * Math.PI/180, p2 = lat2 * Math.PI/180;
            const a = Math.sin((p2-p1)/2)**2 + Math.cos(p1) * Math.cos(p2) * Math.sin(((lon2-lon1)*Math.PI/180)/2)**2;
            return 6371000 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)));
          };

          const endEvent = endFlags[endFlags.length - 1];
          let endedAtHome = false;

          for (const c of processedTrip.clients) {
            if (c.isVendorHome && getDist(endEvent.lat, endEvent.lng, c.lat, c.lng) <= 150) {
              endedAtHome = true; break;
            }
          }

          if (endedAtHome) {
            timeHome += gapMinutos;
          } else {
            timeNonClients += gapMinutos;
          }
        }
      }

      let eventos = stops.map(stop => ({
        hora: stop.time,
        tipo: stop.isVendorHome ? 'Casa' : 
              ['3689', '6395'].includes(String(stop.clientKey)) ? 'Tools' : 
              (stop.clientKey && stop.clientName !== 'Sin coincidencia') ? 'Cliente' : 'No Productivo',
        descripcion: stop.clientName || 'Sin coincidencia',
        claveCliente: stop.clientKey || '',
        duracion: stop.durationMin,
        esLaboral: (parseToMins(stop.time) >= WORK_START_MIN && parseToMins(stop.time) < WORK_END_MIN)
      }));

      eventos.sort((a, b) => parseToMins(a.hora) - parseToMins(b.hora));

      const paradasDetalladas = [];
      let lastEndTime = null;

      if (startFlags.length > 0) {
        paradasDetalladas.push({
          hora: startFlags[0].time, tipo: 'Inicio de Recorrido', descripcion: 'Arranque de ruta diaria',
          claveCliente: '', duracion: 0, esLaboral: false 
        });
        lastEndTime = parseToMins(startFlags[0].time);
      }

      for (const ev of eventos) {
        const startEv = parseToMins(ev.hora);
        
        if (lastEndTime !== null && startEv > lastEndTime) {
          const durTraslado = startEv - lastEndTime;
          const h = Math.floor(lastEndTime / 60);
          const m = lastEndTime % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const formatH = h % 12 || 12;
          const horaStr = `${String(formatH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;

          paradasDetalladas.push({
            hora: horaStr, tipo: 'Traslado', descripcion: 'Movimiento en ruta',
            claveCliente: '', duracion: durTraslado, 
            esLaboral: (lastEndTime >= WORK_START_MIN && lastEndTime < WORK_END_MIN)
          });
        }
        
        paradasDetalladas.push(ev);
        lastEndTime = startEv + ev.duracion;
      }

      if (endFlags.length > 0) {
        const endEvMin = parseToMins(endFlags[endFlags.length - 1].time);
        
        if (lastEndTime !== null && endEvMin > lastEndTime) {
          const durTraslado = endEvMin - lastEndTime;
          const h = Math.floor(lastEndTime / 60);
          const m = lastEndTime % 60;
          const ampm = h >= 12 ? 'PM' : 'AM';
          const formatH = h % 12 || 12;
          paradasDetalladas.push({
            hora: `${String(formatH).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`, 
            tipo: 'Traslado', descripcion: 'Regreso / Movimiento final',
            claveCliente: '', duracion: durTraslado, 
            esLaboral: (lastEndTime >= WORK_START_MIN && lastEndTime < WORK_END_MIN)
          });
        }

        paradasDetalladas.push({
          hora: endFlags[endFlags.length - 1].time, tipo: 'Fin de Recorrido', descripcion: 'Fin de ruta diaria',
          claveCliente: '', duracion: 0, esLaboral: false
        });
      }

      const distKm = processedTrip.summary.totalDistanceKm || 0;

      dailyBreakdown.push({
        fecha: processedTrip.fecha, vehiculo: row.vehiculo, distanciaKm: distKm,
        paradasCount: stops.length, clientesVisitadosCount: dailyUniqueClients.size,
        tiempos: {
          laboral: { clientes: timeClients, noClientes: timeNonClients, casa: timeHome, tools: timeTools, traslados: timeTraslados },
          extra: { clientes: timeClientsExtra, noClientes: timeNonClientsExtra, casa: timeHomeExtra, tools: timeToolsExtra, traslados: timeTrasladosExtra }
        },
        horarios: { inicio: processedTrip.summary.workStartTime, fin: processedTrip.summary.workEndTime },
        paradasDetalladas: paradasDetalladas
      });

      globalSummary.diasTrabajados += 1;
      globalSummary.distanciaTotalKm += distKm;
      globalSummary.totalParadas += stops.length;

      globalSummary.tiempos.productivo.laboral += timeClients; globalSummary.tiempos.productivo.extra += timeClientsExtra;
      globalSummary.tiempos.noProductivo.laboral += timeNonClients; globalSummary.tiempos.noProductivo.extra += timeNonClientsExtra;
      globalSummary.tiempos.casa.laboral += timeHome; globalSummary.tiempos.casa.extra += timeHomeExtra;
      globalSummary.tiempos.tools.laboral += timeTools; globalSummary.tiempos.tools.extra += timeToolsExtra;
      globalSummary.tiempos.traslados.laboral += timeTraslados; globalSummary.tiempos.traslados.extra += timeTrasladosExtra;
    }

    globalSummary.clientesUnicosVisitados = globalSummary.clientesUnicosVisitados.size;

    return res.status(200).json({ vendedor: rutasRows[0].nombre_vendedor || vendedorId, rango: { start: startDate, end: endDate }, globalSummary, dailyBreakdown });

  } catch (error) {
    console.error('[Behavior Analytics] Error:', error);
    return res.status(500).json({ error: 'Error interno procesando patrón de conducta.' });
  }
}

module.exports = { getBehaviorAnalytics };