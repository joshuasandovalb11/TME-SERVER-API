const { Server } = require('socket.io');
const realtimeService = require('../services/realtime.service');

const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: '*', // Permitir conexión desde el dashboard React o la App Móvil
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    // Asumimos inicialmente que es un dashboard y lo metemos a la sala
    socket.join('dashboards');

    // Escucha pings en tiempo real de los teléfonos móviles
    socket.on('mobile_ping', (data) => {
      // Si recibimos un ping, significa que es un móvil. Lo sacamos de la sala de dashboards para no enviarle retransmisiones.
      if (socket.rooms.has('dashboards')) {
        socket.leave('dashboards');
      }

      // 1. Guardar/Sobrescribir en el buffer perezoso de la base de datos
      realtimeService.updateLocationInBuffer(data);

      // 2. Retransmitir instantáneamente SOLO a la sala de dashboards
      io.to('dashboards').volatile.emit('dashboard_update', data);
    });

  });

  console.log('✅ WebSockets (Motor de Tiempo Real) inicializados correctamente.');
};

module.exports = {
  initSockets
};
