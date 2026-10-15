import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import { DefaultEventsMap, Namespace, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { pedidos } from '../database/schema';

const TAMANO_MAXIMO_BLOQUE = 64 * 1024;
const TIEMPO_RESPUESTA_MS = 90 * 1000;
const TIEMPO_TRANSFERENCIA_MS = 15 * 60 * 1000;

type UsuarioSocket = {
  id: number;
  username: string;
  rol: string;
  area: string | null;
};

type DatosSocket = {
  usuario?: UsuarioSocket;
};

type SocketTransferencias = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  DatosSocket
>;

type NamespaceTransferencias = Namespace<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  DatosSocket
>;

type DestinatarioTransferencia = {
  username: string;
  estado: 'pendiente' | 'aceptada' | 'rechazada';
  archivosRecibidos: Set<string>;
};

type ArchivoTransferencia = {
  id: string;
  nombreArchivo: string;
  tamano: number;
  tipo: string;
  siguienteSecuencia: number;
  bytesEnviados: number;
};

type TransferenciaActiva = {
  remitenteSocketId: string;
  pedidoId: number;
  archivos: Map<string, ArchivoTransferencia>;
  destinatarios: Map<string, DestinatarioTransferencia>;
  envioCompletado: boolean;
  timeout: NodeJS.Timeout;
};

type ResultadoTransferencia = { ok: true } | { ok: false; error: string };

@WebSocketGateway({
  namespace: 'pedidos',
  cors: {
    origin: '*',
  },
})
export class PedidosGateway {
  @WebSocketServer()
  server!: NamespaceTransferencias;

  private readonly transferencias = new Map<string, TransferenciaActiva>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly database: DatabaseService,
  ) {}

  async handleConnection(client: SocketTransferencias) {
    const auth = client.handshake.auth as { token?: unknown };
    const token = auth.token;
    if (typeof token === 'string') {
      try {
        const payload = await this.jwtService.verifyAsync<{
          sub: number;
          username: string;
          rol: string;
          area: string | null;
          sistema?: string;
        }>(token);

        if (
          payload.sistema === 'INVENTARIO' ||
          !Number.isInteger(payload.sub) ||
          typeof payload.username !== 'string' ||
          typeof payload.rol !== 'string'
        ) {
          client.disconnect(true);
          return;
        }

        client.data.usuario = {
          id: payload.sub,
          username: payload.username,
          rol: payload.rol,
          area: payload.area ?? null,
        } satisfies UsuarioSocket;
      } catch {
        console.warn(
          'Conexión WebSocket de pedidos rechazada por token inválido.',
        );
        client.disconnect(true);
        return;
      }
    }

    console.log(`Cliente WebSocket conectado: ${client.id}`);
  }

  handleDisconnect(client: SocketTransferencias) {
    for (const [transferenciaId, transferencia] of this.transferencias) {
      if (transferencia.remitenteSocketId === client.id) {
        this.server
          .to([...transferencia.destinatarios.keys()])
          .emit('transferencia:cancelada', {
            transferenciaId,
            motivo: 'El remitente se desconectó.',
          });
        this.eliminarTransferencia(transferenciaId);
        continue;
      }

      const destinatario = transferencia.destinatarios.get(client.id);
      if (!destinatario) continue;

      destinatario.estado = 'rechazada';
      this.server
        .to(transferencia.remitenteSocketId)
        .emit('transferencia:estado-destinatario', {
          transferenciaId,
          username: destinatario.username,
          estado: 'desconectado',
        });
      this.notificarDestinatariosListos(transferenciaId, transferencia);
    }

    console.log(`Cliente WebSocket desconectado: ${client.id}`);
  }

  @SubscribeMessage('ping')
  handlePing(
    @MessageBody() mensaje: string,
    @ConnectedSocket() client: SocketTransferencias,
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

  emitirInventarioActualizado() {
    this.server.emit('inventarioActualizado');
    this.emitirFinanzasActualizadas();
  }

  @SubscribeMessage('transferencia:invitar')
  async invitarTransferencia(
    @MessageBody()
    datos: {
      pedidoId: number;
      archivos: {
        id: string;
        nombreArchivo: string;
        tamano: number;
        tipo: string;
      }[];
    },
    @ConnectedSocket() client: SocketTransferencias,
  ): Promise<
    | {
        ok: true;
        transferenciaId: string;
        destinatarios: { socketId: string; username: string }[];
      }
    | { ok: false; error: string }
  > {
    const usuario = this.obtenerUsuarioAutenticado(client);
    if (!usuario) {
      return { ok: false, error: 'Inicia sesión para transferir archivos.' };
    }
    if (!this.puedeEnviar(usuario)) {
      return {
        ok: false,
        error: 'Solo diseño o administración puede enviar archivos.',
      };
    }
    if (
      !Number.isInteger(datos?.pedidoId) ||
      !this.validarArchivos(datos.archivos)
    ) {
      return {
        ok: false,
        error: 'La lista de archivos no es válida.',
      };
    }

    const [pedido] = await this.database.db
      .select({ servicio: pedidos.servicio, ancho: pedidos.ancho })
      .from(pedidos)
      .where(eq(pedidos.id, datos.pedidoId))
      .limit(1);
    if (!pedido) {
      return { ok: false, error: 'No se encontró el pedido.' };
    }
    const area = this.obtenerAreaPedido(pedido);
    if (!area) {
      return {
        ok: false,
        error: 'El pedido no tiene un área de producción válida.',
      };
    }

    const sockets = await this.server.fetchSockets();
    const destinatarios = sockets.flatMap((socket) => {
      const empleado = socket.data.usuario;
      return empleado?.rol === 'EMPLEADO' &&
        empleado.area === area &&
        socket.id !== client.id
        ? [{ socket, empleado }]
        : [];
    });
    if (destinatarios.length === 0) {
      return {
        ok: false,
        error: 'No hay empleados conectados en el área de este pedido.',
      };
    }

    const transferenciaId = randomUUID();
    const transferencia: TransferenciaActiva = {
      remitenteSocketId: client.id,
      pedidoId: datos.pedidoId,
      archivos: new Map(
        datos.archivos.map((archivo) => [
          archivo.id,
          {
            id: archivo.id,
            nombreArchivo: this.limpiarNombreArchivo(archivo.nombreArchivo),
            tamano: archivo.tamano,
            tipo: archivo.tipo.slice(0, 255),
            siguienteSecuencia: 0,
            bytesEnviados: 0,
          },
        ]),
      ),
      destinatarios: new Map(
        destinatarios.map(({ socket, empleado }) => [
          socket.id,
          {
            username: empleado.username,
            estado: 'pendiente',
            archivosRecibidos: new Set<string>(),
          },
        ]),
      ),
      envioCompletado: false,
      timeout: setTimeout(() => {
        this.expirarTransferencia(transferenciaId, transferencia);
      }, TIEMPO_RESPUESTA_MS),
    };
    transferencia.timeout.unref();
    this.transferencias.set(transferenciaId, transferencia);

    for (const { socket } of destinatarios) {
      socket.emit('transferencia:solicitud', {
        transferenciaId,
        pedidoId: datos.pedidoId,
        archivos: [...transferencia.archivos.values()],
        remitente: usuario.username,
      });
    }

    return {
      ok: true,
      transferenciaId,
      destinatarios: destinatarios.map(({ socket, empleado }) => ({
        socketId: socket.id,
        username: empleado.username,
      })),
    };
  }

  @SubscribeMessage('transferencia:responder')
  responderTransferencia(
    @MessageBody()
    datos: { transferenciaId: string; aceptada: boolean },
    @ConnectedSocket() client: SocketTransferencias,
  ): ResultadoTransferencia {
    const usuario = this.obtenerUsuarioAutenticado(client);
    const transferencia = this.transferencias.get(datos?.transferenciaId);
    const destinatario = transferencia?.destinatarios.get(client.id);
    if (
      !usuario ||
      usuario.rol !== 'EMPLEADO' ||
      !transferencia ||
      !destinatario ||
      destinatario.estado !== 'pendiente' ||
      typeof datos.aceptada !== 'boolean'
    ) {
      return {
        ok: false,
        error: 'La solicitud de transferencia ya no está disponible.',
      };
    }

    destinatario.estado = datos.aceptada ? 'aceptada' : 'rechazada';
    this.server
      .to(transferencia.remitenteSocketId)
      .emit('transferencia:estado-destinatario', {
        transferenciaId: datos.transferenciaId,
        username: destinatario.username,
        estado: datos.aceptada ? 'aceptado' : 'rechazado',
      });
    this.notificarDestinatariosListos(datos.transferenciaId, transferencia);
    return { ok: true };
  }

  @SubscribeMessage('transferencia:bloque')
  enviarBloque(
    @MessageBody()
    datos: {
      transferenciaId: string;
      archivoId: string;
      secuencia: number;
      contenido: Uint8Array | Buffer;
    },
    @ConnectedSocket() client: SocketTransferencias,
  ): ResultadoTransferencia {
    const transferencia = this.transferencias.get(datos?.transferenciaId);
    const archivo = transferencia?.archivos.get(datos?.archivoId);
    if (
      !transferencia ||
      !archivo ||
      transferencia.remitenteSocketId !== client.id ||
      !Number.isInteger(datos.secuencia) ||
      datos.secuencia !== archivo.siguienteSecuencia ||
      !(datos.contenido instanceof Uint8Array) ||
      datos.contenido.byteLength > TAMANO_MAXIMO_BLOQUE
    ) {
      return { ok: false, error: 'No se pudo continuar la transferencia.' };
    }

    const bytesRestantes = archivo.tamano - archivo.bytesEnviados;
    if (datos.contenido.byteLength > bytesRestantes) {
      return {
        ok: false,
        error: 'El archivo recibido no coincide con su tamaño.',
      };
    }
    const destinatarios = [...transferencia.destinatarios.entries()].filter(
      ([, destinatario]) => destinatario.estado === 'aceptada',
    );
    if (destinatarios.length === 0) {
      return {
        ok: false,
        error: 'No quedan empleados conectados para recibir el archivo.',
      };
    }

    for (const [socketId] of destinatarios) {
      this.server.to(socketId).emit('transferencia:bloque', {
        transferenciaId: datos.transferenciaId,
        archivoId: datos.archivoId,
        secuencia: datos.secuencia,
        contenido: datos.contenido,
      });
    }
    archivo.siguienteSecuencia += 1;
    archivo.bytesEnviados += datos.contenido.byteLength;
    this.reiniciarTimeout(datos.transferenciaId, transferencia);
    return { ok: true };
  }

  @SubscribeMessage('transferencia:archivo-completado')
  completarTransferencia(
    @MessageBody() datos: { transferenciaId: string; archivoId: string },
    @ConnectedSocket() client: SocketTransferencias,
  ): ResultadoTransferencia {
    const transferencia = this.transferencias.get(datos?.transferenciaId);
    const archivo = transferencia?.archivos.get(datos?.archivoId);
    if (
      !transferencia ||
      !archivo ||
      transferencia.remitenteSocketId !== client.id ||
      archivo.bytesEnviados !== archivo.tamano
    ) {
      return {
        ok: false,
        error: 'La transferencia no se completó correctamente.',
      };
    }

    this.server
      .to(
        [...transferencia.destinatarios.entries()]
          .filter(([, destinatario]) => destinatario.estado === 'aceptada')
          .map(([socketId]) => socketId),
      )
      .emit('transferencia:archivo-listo', {
        transferenciaId: datos.transferenciaId,
        archivoId: datos.archivoId,
      });
    if (
      [...transferencia.archivos.values()].every(
        (item) => item.bytesEnviados === item.tamano,
      )
    ) {
      transferencia.envioCompletado = true;
      this.eliminarSiTodosRecibieron(datos.transferenciaId, transferencia);
    }
    return { ok: true };
  }

  @SubscribeMessage('transferencia:archivo-recibido')
  confirmarArchivoRecibido(
    @MessageBody() datos: { transferenciaId: string; archivoId: string },
    @ConnectedSocket() client: SocketTransferencias,
  ): ResultadoTransferencia {
    const usuario = this.obtenerUsuarioAutenticado(client);
    const transferencia = this.transferencias.get(datos?.transferenciaId);
    const destinatario = transferencia?.destinatarios.get(client.id);
    const archivo = transferencia?.archivos.get(datos?.archivoId);
    if (
      !usuario ||
      usuario.rol !== 'EMPLEADO' ||
      !transferencia ||
      !destinatario ||
      destinatario.estado !== 'aceptada' ||
      !archivo ||
      archivo.bytesEnviados !== archivo.tamano
    ) {
      return {
        ok: false,
        error: 'No se pudo confirmar la recepción del archivo.',
      };
    }

    if (!transferencia.archivos.has(datos.archivoId)) {
      return {
        ok: false,
        error: 'El archivo no pertenece a esta transferencia.',
      };
    }
    destinatario.archivosRecibidos.add(datos.archivoId);
    this.server
      .to(transferencia.remitenteSocketId)
      .emit('transferencia:estado-destinatario', {
        transferenciaId: datos.transferenciaId,
        archivoId: datos.archivoId,
        username: destinatario.username,
        estado: 'recibido',
      });
    this.eliminarSiTodosRecibieron(datos.transferenciaId, transferencia);
    return { ok: true };
  }

  @SubscribeMessage('transferencia:cancelar')
  cancelarTransferencia(
    @MessageBody() datos: { transferenciaId: string },
    @ConnectedSocket() client: SocketTransferencias,
  ): ResultadoTransferencia {
    const transferencia = this.transferencias.get(datos?.transferenciaId);
    if (!transferencia) {
      return { ok: true };
    }
    if (transferencia.remitenteSocketId !== client.id) {
      return { ok: false, error: 'No puedes cancelar esta transferencia.' };
    }

    this.server
      .to([...transferencia.destinatarios.keys()])
      .emit('transferencia:cancelada', {
        transferenciaId: datos.transferenciaId,
        motivo: 'El remitente canceló la transferencia.',
      });
    this.eliminarTransferencia(datos.transferenciaId);
    return { ok: true };
  }

  private obtenerUsuarioAutenticado(
    client: SocketTransferencias,
  ): UsuarioSocket | null {
    const usuario = client.data.usuario;
    return usuario ?? null;
  }

  private puedeEnviar(usuario: UsuarioSocket): boolean {
    return ['ADMIN', 'DISENADOR', 'DISEÑADOR'].includes(usuario.rol);
  }

  private validarArchivos(archivos: unknown): archivos is {
    id: string;
    nombreArchivo: string;
    tamano: number;
    tipo: string;
  }[] {
    if (
      !Array.isArray(archivos) ||
      archivos.length === 0 ||
      archivos.length > 100
    ) {
      return false;
    }

    const ids = new Set<string>();
    return archivos.every((archivo: unknown) => {
      if (typeof archivo !== 'object' || archivo === null) return false;
      const candidato = archivo as Record<string, unknown>;
      if (
        typeof candidato.id !== 'string' ||
        candidato.id.length === 0 ||
        ids.has(candidato.id) ||
        typeof candidato.nombreArchivo !== 'string' ||
        this.limpiarNombreArchivo(candidato.nombreArchivo).length === 0 ||
        !Number.isSafeInteger(candidato.tamano) ||
        (candidato.tamano as number) < 0 ||
        typeof candidato.tipo !== 'string'
      ) {
        return false;
      }
      ids.add(candidato.id);
      return true;
    });
  }

  private limpiarNombreArchivo(nombreArchivo: string) {
    return nombreArchivo.split(/[\\/]/).pop()?.trim().slice(0, 255) ?? '';
  }

  private obtenerAreaPedido(pedido: { servicio: string; ancho: number }) {
    if (pedido.servicio === 'UV') return 'UV';
    if (pedido.servicio !== 'TEXTIL') return null;
    if (pedido.ancho === 31) return 'TEXTIL31';
    if (pedido.ancho === 58) return 'TEXTIL58';
    return null;
  }

  private notificarDestinatariosListos(
    transferenciaId: string,
    transferencia: TransferenciaActiva,
  ) {
    const destinatarios = [...transferencia.destinatarios.entries()];
    if (
      destinatarios.some(
        ([, destinatario]) => destinatario.estado === 'pendiente',
      )
    ) {
      return;
    }

    const aceptados = destinatarios
      .filter(([, destinatario]) => destinatario.estado === 'aceptada')
      .map(([socketId]) => socketId);
    this.server
      .to(transferencia.remitenteSocketId)
      .emit('transferencia:destinatarios-listos', {
        transferenciaId,
        cantidadAceptada: aceptados.length,
      });

    if (aceptados.length === 0) {
      this.eliminarTransferencia(transferenciaId);
      return;
    }
    this.reiniciarTimeout(transferenciaId, transferencia);
  }

  private eliminarSiTodosRecibieron(
    transferenciaId: string,
    transferencia: TransferenciaActiva,
  ) {
    if (!transferencia.envioCompletado) return;
    const aceptados = [...transferencia.destinatarios.values()].filter(
      (destinatario) => destinatario.estado === 'aceptada',
    );
    if (
      aceptados.every(
        (destinatario) =>
          destinatario.archivosRecibidos.size === transferencia.archivos.size,
      )
    ) {
      this.eliminarTransferencia(transferenciaId);
    }
  }

  private reiniciarTimeout(
    transferenciaId: string,
    transferencia: TransferenciaActiva,
  ) {
    clearTimeout(transferencia.timeout);
    transferencia.timeout = setTimeout(() => {
      this.expirarTransferencia(transferenciaId, transferencia);
    }, TIEMPO_TRANSFERENCIA_MS);
    transferencia.timeout.unref();
  }

  private expirarTransferencia(
    transferenciaId: string,
    transferencia: TransferenciaActiva,
  ) {
    for (const [socketId, destinatario] of transferencia.destinatarios) {
      if (destinatario.estado === 'pendiente') {
        this.server
          .to(transferencia.remitenteSocketId)
          .emit('transferencia:estado-destinatario', {
            transferenciaId,
            username: destinatario.username,
            estado: 'expirado',
          });
      } else if (destinatario.estado === 'aceptada') {
        for (const archivo of transferencia.archivos.values()) {
          if (!destinatario.archivosRecibidos.has(archivo.id)) {
            this.server
              .to(transferencia.remitenteSocketId)
              .emit('transferencia:estado-destinatario', {
                transferenciaId,
                archivoId: archivo.id,
                username: destinatario.username,
                estado: 'expirado',
              });
          }
        }
      }
      this.server.to(socketId).emit('transferencia:expirada', {
        transferenciaId,
      });
    }
    this.server
      .to(transferencia.remitenteSocketId)
      .emit('transferencia:expirada', { transferenciaId });
    this.eliminarTransferencia(transferenciaId);
  }

  private eliminarTransferencia(transferenciaId: string) {
    const transferencia = this.transferencias.get(transferenciaId);
    if (!transferencia) return;
    clearTimeout(transferencia.timeout);
    this.transferencias.delete(transferenciaId);
  }
}
