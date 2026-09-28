import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: 'pedidos',
  cors: {
    origin: '*',
  },
})
export class PedidosGateway {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente WebSocket conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente WebSocket desconectado: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() mensaje: string,
    @ConnectedSocket() client: Socket,
  ) {
    client.emit('pong', {
      mensaje,
      fecha: new Date(),
    });
  }

  emitirPedidoActualizado(pedido: unknown) {
    this.server.emit('pedidoActualizado', pedido);
  }

  emitirFinanzasActualizadas() {
    this.server.emit('finanzasActualizadas');
  }
}
