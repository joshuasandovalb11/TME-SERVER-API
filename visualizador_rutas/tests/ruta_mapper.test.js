// visualizador_rutas/tests/ruta_mapper.test.js
const assert = require('node:assert/strict');
const {
  normalizeTime,
  parseRawEventsJson,
  mapRawEvents,
  buildProcessedTripPayload
} = require('../services/ruta_mapper');

function testNormalizeTime() {
  assert.equal(normalizeTime('8:01:02'), '08:01:02');
  assert.equal(normalizeTime('08:30'), '08:30:00');
  assert.equal(normalizeTime(null), '00:00:00');
}

function testParseAndMapEvents() {
  const rawJson = JSON.stringify([
    { h: '08:00', evt: 'Inicio de Viaje', lat: 32.5, lng: -116.9, vel: 10, odo: 1000 },
    { h: '08:05', evt: 'En ruta', lat: 32.501, lng: -116.901, vel: 15, odo: 1002 },
    { h: '08:10', evt: 'Parado', lat: 32.501, lng: -116.901, vel: 0, odo: 1002 },
    { h: '08:20', evt: 'Reanuda', lat: 32.502, lng: -116.902, vel: 20, odo: 1003 },
    { h: '08:30', evt: 'Fin de Viaje', lat: 32.503, lng: -116.903, vel: 0, odo: 1005 }
  ]);

  const raw = parseRawEventsJson(rawJson);
  const events = mapRawEvents(raw);

  assert.equal(events.length, 5);
  assert.equal(events[0].time, '08:00:00');
  assert.equal(events[4].description, 'Fin de Viaje');
}

function testBuildProcessedPayload() {
  const row = {
    id_ruta_diaria: 55,
    fecha: '2026-05-05',
    id_vendedor: 'ABC',
    nombre_vendedor: 'Vendedor Test',
    placa: 'XYZ-123',
    vehiculo: 'Nissan'
  };

  const rawEvents = [
    { h: '08:00', evt: 'Inicio de Viaje', lat: 32.5, lng: -116.9, vel: 10, odo: 1000 },
    { h: '08:10', evt: 'Parado', lat: 32.501, lng: -116.901, vel: 0, odo: 1002 },
    { h: '08:20', evt: 'Reanuda', lat: 32.502, lng: -116.902, vel: 15, odo: 1003 },
    { h: '08:35', evt: 'Fin de Viaje', lat: 32.503, lng: -116.903, vel: 0, odo: 1005 }
  ];

  const viajesAnaliticos = [
    {
      hora_inicio: '08:00',
      latitud_inicio: 32.5,
      longitud_inicio: -116.9,
      hora_fin: '08:35',
      latitud_final: 32.503,
      longitud_final: -116.903
    }
  ];

  const clientes = [{ key: 'C1', lat: 32.501, lng: -116.901, vendor: 'ABC' }];

  const payload = buildProcessedTripPayload({
    row,
    viajesAnaliticos,
    rawEvents,
    minStopDuration: 5,
    clientes
  });

  assert.equal(payload.idRuta, 55);
  assert.equal(payload.events.length, 4);
  assert.equal(payload.path.length, 4);
  assert.ok(payload.flags.some((f) => f.type === 'trip_start'));
  assert.ok(payload.flags.some((f) => f.type === 'trip_end'));
  assert.ok(payload.flags.some((f) => f.type === 'stop'));
  assert.equal(payload.summary.isTripOngoing, false);
  assert.equal(payload.clients.length, 1);
}

function run() {
  testNormalizeTime();
  testParseAndMapEvents();
  testBuildProcessedPayload();
  console.log('OK: ruta_mapper tests passed');
}

run();
