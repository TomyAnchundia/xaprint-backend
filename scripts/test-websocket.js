const { io } = require('socket.io-client');

const socket = io('http://localhost:3000/pedidos');

socket.on('connect', () => {
  console.log('✅ WebSocket conectado');
  console.log('ID:', socket.id);

  socket.emit('ping', 'Hola desde el cliente de prueba');
});

socket.on('pong', (data) => {
  console.log('🏓 Pong recibido:');
  console.log(data);
});

socket.on('pedidoActualizado', (pedido) => {
  console.log('\n📦 Pedido actualizado:');
  console.log(pedido);
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error.message);
});

socket.on('disconnect', (motivo) => {
  console.log('🔌 WebSocket desconectado:', motivo);
});
