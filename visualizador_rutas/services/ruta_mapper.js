// visualizador_rutas/services/ruta_mapper.js

function fuzzyMatchNames(name1, name2) {
  if (!name1 || !name2) return false;

  const tokenize = (str) => {
    return str.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") 
      .replace(/[^a-z0-9]/g, " ") 
      .split(/\s+/)
      .filter(word => word.length > 2); 
  };

  const tokens1 = tokenize(String(name1));
  const tokens2 = tokenize(String(name2));

  if (tokens1.length === 0 || tokens2.length === 0) return false;

  const intersection = tokens1.filter(t => tokens2.includes(t));
  const minRequired = Math.min(2, tokens1.length, tokens2.length);

  return intersection.length >= minRequired;
}

function toBool(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return ['1', 'true', 'yes', 'si'].includes(String(value).toLowerCase());
}

function extractTimeComponents(timeValue) {
  if (timeValue === undefined || timeValue === null) return null;
  
  if (timeValue instanceof Date && !isNaN(timeValue.getTime())) {
    return {
      h: timeValue.getUTCHours(),
      m: timeValue.getUTCMinutes(),
      s: timeValue.getUTCSeconds()
    };
  }

  const timeStr = String(timeValue);
  const timeMatch = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (timeMatch) {
    return {
      h: Number(timeMatch[1]),
      m: Number(timeMatch[2]),
      s: Number(timeMatch[3] || 0)
    };
  }

  const numTime = Number(timeValue);
  if (!isNaN(numTime) && numTime >= 0 && numTime <= 1) {
    const totalSeconds = Math.round(numTime * 24 * 3600);
    return {
      h: Math.floor(totalSeconds / 3600),
      m: Math.floor((totalSeconds % 3600) / 60),
      s: totalSeconds % 60
    };
  }

  return null;
}

function toSeconds(timeValue) {
  const comp = extractTimeComponents(timeValue);
  if (!comp) return null;
  return comp.h * 3600 + comp.m * 60 + comp.s;
}

function normalizeTime(value) {
  const comp = extractTimeComponents(value);
  if (!comp) return '00:00:00';
  
  const hh = String(comp.h).padStart(2, '0');
  const mm = String(comp.m).padStart(2, '0');
  const ss = String(comp.s).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2))
    * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function calculateDistanceMetrics(path) {
  if (!Array.isArray(path) || path.length < 2) {
    return { totalDistanceMeters: 0, totalDistanceKm: 0 };
  }

  let meters = 0;
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const curr = path[i];
    meters += haversineMeters(prev.lat, prev.lng, curr.lat, curr.lng);
  }

  return {
    totalDistanceMeters: Number(meters.toFixed(2)),
    totalDistanceKm: Number((meters / 1000).toFixed(3))
  };
}

function mapRawEvents(rawEvents) {
  if (!Array.isArray(rawEvents)) return [];

  return rawEvents
    .map((item, idx) => {
      const lat = Number(item.lat);
      const lng = Number(item.lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;

      return {
        id: idx + 1,
        rawIndex: idx,
        time: normalizeTime(item.h),
        description: String(item.evt || '').trim(),
        speed: Number(item.vel || 0),
        lat,
        lng,
        odo: Number(item.odo || 0)
      };
    })
    .filter(Boolean);
}

function buildStopFlags(events, minStopMinutes, tripEndSec = Infinity) {
  const stopFlags = [];
  if (!Array.isArray(events) || events.length === 0) return stopFlags;

  let stopStart = null;

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    const speed = Number(event.speed || 0);
    const currentSec = toSeconds(event.time);

    if (currentSec > tripEndSec) {
      if (stopStart) {
        const startSec = stopStart.timeSec;
        if (startSec !== null && tripEndSec > startSec) {
          const durationMin = Math.floor((tripEndSec - startSec) / 60);
          if (durationMin >= minStopMinutes) {
            stopFlags.push({
              type: 'stop',
              lat: stopStart.event.lat,
              lng: stopStart.event.lng,
              time: stopStart.event.time,
              durationMin,
              source: 'speed-threshold-truncated'
            });
          }
        }
        stopStart = null;
      }
      continue; 
    }

    if (speed <= 2 && stopStart === null) {
      stopStart = { timeSec: currentSec, event };
      continue;
    }

    if (speed > 2 && stopStart) {
      const startSec = stopStart.timeSec;
      if (startSec !== null && currentSec !== null && currentSec > startSec) {
        let endSec = Math.min(currentSec, tripEndSec); 
        const durationMin = Math.floor((endSec - startSec) / 60);
        if (durationMin >= minStopMinutes) {
          stopFlags.push({
            type: 'stop',
            lat: stopStart.event.lat,
            lng: stopStart.event.lng,
            time: stopStart.event.time,
            durationMin,
            source: 'speed-threshold'
          });
        }
      }
      stopStart = null;
    }
  }

  if (stopStart) {
    const startSec = stopStart.timeSec;
    const lastEventSec = toSeconds(events[events.length - 1].time);
    const endSec = Math.min(lastEventSec, tripEndSec);

    if (startSec !== null && endSec > startSec) {
      const durationMin = Math.floor((endSec - startSec) / 60);
      if (durationMin >= minStopMinutes) {
        stopFlags.push({
          type: 'stop',
          lat: stopStart.event.lat,
          lng: stopStart.event.lng,
          time: stopStart.event.time,
          durationMin,
          source: 'speed-threshold-end'
        });
      }
    }
  }

  return stopFlags;
}

function buildTripBoundaryFlags(viajesAnaliticos) {
  if (!Array.isArray(viajesAnaliticos) || viajesAnaliticos.length === 0) return [];

  const flags = [];
  
  const primerViaje = viajesAnaliticos[0];
  flags.push({
    type: 'trip_start',
    lat: Number(primerViaje.latitud_inicio),
    lng: Number(primerViaje.longitud_inicio),
    time: normalizeTime(primerViaje.hora_inicio),
    source: 'viajes-table'
  });

  const ultimoViaje = viajesAnaliticos[viajesAnaliticos.length - 1];
  flags.push({
    type: 'trip_end',
    lat: Number(ultimoViaje.latitud_final),
    lng: Number(ultimoViaje.longitud_final),
    time: normalizeTime(ultimoViaje.hora_fin),
    source: 'viajes-table'
  });

  return flags;
}

function getWorkWindow(events) {
  if (!Array.isArray(events) || events.length === 0) {
    return { workStartTime: null, workEndTime: null };
  }

  const firstMoving = events.find((ev) => Number(ev.speed || 0) > 0);
  const lastMoving = [...events].reverse().find((ev) => Number(ev.speed || 0) > 0);

  return {
    workStartTime: firstMoving ? firstMoving.time : events[0].time,
    workEndTime: lastMoving ? lastMoving.time : events[events.length - 1].time
  };
}

function parseRawEventsJson(jsonValue) {
  try {
    const parsed = JSON.parse(jsonValue || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
}

function enrichFlagsWithClients(flags, clientes, nombreVendedor) {
  const CLIENT_RADIUS_METERS = 150;
  
  return flags.map(flag => {
    if (flag.type !== 'stop') {
      return {
        ...flag,
        clientKey: null,
        clientName: null,
        clientBranchNumber: null,
        clientBranchName: null,
        isVendorHome: false
      };
    }

    let matchedClient = null;
    let minDistance = Infinity;

    for (const client of clientes) {
      const dist = haversineMeters(flag.lat, flag.lng, client.lat, client.lng);
      if (dist <= CLIENT_RADIUS_METERS && dist < minDistance) {
        minDistance = dist;
        matchedClient = client;
      }
    }

    if (matchedClient) {
      const isToolsDeMexico = ['3689', '6395'].includes(String(matchedClient.key));
      
      const isHome = 
        !isToolsDeMexico && 
        matchedClient.isEmpleadoTME === true && 
        fuzzyMatchNames(matchedClient.name, nombreVendedor);

      return {
        ...flag,
        clientKey: matchedClient.key,
        clientName: matchedClient.name,
        clientBranchNumber: matchedClient.branchNumber,
        clientBranchName: matchedClient.clientBranchName || '',
        isVendorHome: isHome
      };
    }

    return {
      ...flag,
      clientKey: null,
      clientName: 'Sin coincidencia',
      clientBranchNumber: null,
      clientBranchName: null,
      isVendorHome: false
    };
  });
}

function buildProcessedTripPayload({ row, viajesAnaliticos, rawEvents, minStopDuration, clientes }) {
  const events = mapRawEvents(rawEvents);
  
  const path = [];
  let isParked = false;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i];
    
    if (i === 0 || i === events.length - 1) {
      path.push({ lat: ev.lat, lng: ev.lng, time: ev.time, speed: ev.speed, odo: ev.odo });
      isParked = ev.speed <= 2;
      continue;
    }

    if (ev.speed > 2) {
      path.push({ lat: ev.lat, lng: ev.lng, time: ev.time, speed: ev.speed, odo: ev.odo });
      isParked = false;
    } else {
      if (!isParked) {
        path.push({ lat: ev.lat, lng: ev.lng, time: ev.time, speed: ev.speed, odo: ev.odo });
        isParked = true;
      } else {
        const nextEv = events[i + 1];
        if (nextEv && nextEv.speed > 2) {
          path.push({ lat: ev.lat, lng: ev.lng, time: ev.time, speed: ev.speed, odo: ev.odo });
        }
      }
    }
  }

  const distance = calculateDistanceMetrics(path);
  
  let tripBoundaryFlags = buildTripBoundaryFlags(viajesAnaliticos);
  
  let officialTripEndSec = Infinity; 

  if (tripBoundaryFlags.length === 0 && events.length > 0) {
    const firstMovingIdx = events.findIndex(ev => ev.speed > 0);
    
    let lastMovingIdx = -1;
    for (let i = events.length - 1; i >= 0; i--) {
      if (events[i].speed > 0) {
        lastMovingIdx = i;
        break;
      }
    }

    let startIndex = 0;
    let endIndex = events.length - 1;

    if (firstMovingIdx > 0) {
      startIndex = firstMovingIdx - 1;
    }

    if (lastMovingIdx !== -1 && lastMovingIdx < events.length - 1) {
      endIndex = lastMovingIdx + 1;
    }

    tripBoundaryFlags.push({
      type: 'trip_start',
      lat: events[startIndex].lat,
      lng: events[startIndex].lng,
      time: events[startIndex].time,
      source: 'inferred-boundaries'
    });

    tripBoundaryFlags.push({
      type: 'trip_end',
      lat: events[endIndex].lat,
      lng: events[endIndex].lng,
      time: events[endIndex].time,
      source: 'inferred-boundaries'
    });
    
    officialTripEndSec = toSeconds(events[endIndex].time);
  } else if (tripBoundaryFlags.length >= 2) {
    officialTripEndSec = toSeconds(tripBoundaryFlags[tripBoundaryFlags.length - 1].time);
  }

  const minMins = Number.isNaN(minStopDuration) ? 5 : minStopDuration;
  
  let stopFlags = buildStopFlags(events, minMins, officialTripEndSec);
  
  if (tripBoundaryFlags.length >= 2) {
    const startSec = toSeconds(tripBoundaryFlags[0].time);
    
    stopFlags = stopFlags.filter(flag => {
      const flagSec = toSeconds(flag.time);
      return flagSec >= startSec; 
    });
  }

  let counter = 1;
  stopFlags.forEach(flag => {
    flag.stopNumber = counter++;
  });
  
  let flags = [...tripBoundaryFlags, ...stopFlags].sort((a, b) => {
    const tA = toSeconds(a.time) || 0;
    const tB = toSeconds(b.time) || 0;
    
    if (tA !== tB) return tA - tB;
    
    const getPriority = (type) => {
      if (type === 'trip_start') return 0;
      if (type === 'stop') return 1;
      if (type === 'trip_end') return 2;
      return 3;
    };
    
    return getPriority(a.type) - getPriority(b.type);
  });
  
  flags = enrichFlagsWithClients(flags, clientes || [], row.nombre_vendedor);

  const sucursalesToolsVisitadas = new Set();
  flags.forEach(flag => {
    if (flag.type === 'stop' && ['3689', '6395'].includes(String(flag.clientKey))) {
      const branchNum = flag.clientBranchNumber || '0';
      sucursalesToolsVisitadas.add(`${flag.clientKey}-${branchNum}`);
    }
  });

  const clientsToFrontend = (clientes || [])
    .map(client => {
      const isToolsDeMexico = ['3689', '6395'].includes(String(client.key));
      const isHome = !isToolsDeMexico && 
                     client.isEmpleadoTME === true && 
                     fuzzyMatchNames(client.name, row.nombre_vendedor);

      return {
        ...client,
        isVendorHome: isHome 
      };
    })
    .filter(client => {
      const isToolsDeMexico = ['3689', '6395'].includes(String(client.key));
      
      if (client.isVendorHome) return true;
    
      if (client.isEmpleadoTME) return false;

      if (isToolsDeMexico) {
        const branchNum = client.branchNumber || '0';
        return sucursalesToolsVisitadas.has(`${client.key}-${branchNum}`);
      }

      return true;
    });

  const workWindow = getWorkWindow(events);

  const lastEventDesc = events.length ? String(events[events.length - 1].description).toLowerCase() : '';
  const isTripOngoing = !lastEventDesc.includes('fin de viaje') && !lastEventDesc.includes('ignition off');

  const fechaNormalizada = row.fecha instanceof Date
    ? row.fecha.toISOString().split('T')[0]
    : String(row.fecha);

  return {
    idRuta: row.id_ruta_diaria,
    fecha: fechaNormalizada,
    vendedor: row.id_vendedor || null,
    nombreVendedor: row.nombre_vendedor || null,
    vehiculo: row.placa,
    descripcion: row.vehiculo,
    events, 
    path, 
    flags,
    viajesAnaliticos,
    summary: {
      totalDistanceKm: distance.totalDistanceKm,
      totalDistanceMeters: distance.totalDistanceMeters,
      workStartTime: workWindow.workStartTime,
      workEndTime: workWindow.workEndTime,
      isTripOngoing,
      processingMethod: 'backend-processed'
    },
    clients: clientsToFrontend
  };
}

module.exports = {
  toBool,
  toSeconds,
  normalizeTime,
  calculateDistanceMetrics,
  mapRawEvents,
  buildStopFlags,
  buildTripBoundaryFlags,
  getWorkWindow,
  parseRawEventsJson,
  buildProcessedTripPayload
};