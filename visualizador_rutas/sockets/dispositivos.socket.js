// visualizador_rutas/sockets/dispositivos.socket.js
const { Server } = require('socket.io');
const realtimeService = require('../services/realtime.service');

const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    socket.join('dashboards');

    socket.on('ubicacion_tiempo_real', (data) => {
      if (socket.rooms.has('dashboards')) {
        socket.leave('dashboards');
      }

      const expandedLocation = realtimeService.updateLocationInBuffer(data);

      if (expandedLocation) {
        io.to('dashboards').volatile.emit('dashboard_update', expandedLocation);
      }
    });

  });

  console.log('✅ WebSockets (Motor de Tiempo Real) inicializados correctamente.');
};

module.exports = {
  initSockets
};
