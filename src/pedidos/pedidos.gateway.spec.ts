import type { JwtService } from '@nestjs/jwt';
import type { DatabaseService } from '../database/database.service';
import { PedidosGateway } from './pedidos.gateway';

jest.mock('@nestjs/jwt', () => ({
  JwtService: class JwtService {},
}));

describe('PedidosGateway transferencias', () => {
  let gateway: PedidosGateway;
  let seleccionarPedido: jest.Mock;
  let obtenerSockets: jest.Mock;
  let emitirA: jest.Mock;
  let emitirEventoSala: jest.Mock;
  type SocketTest = Parameters<PedidosGateway['invitarTransferencia']>[1];

  function crearSocket(id: string, usuario?: object) {
    const emitir = jest.fn();
    return {
      socket: {
        id,
        data: usuario ? { usuario } : {},
        handshake: { auth: {} },
        emit: emitir,
        disconnect: jest.fn(),
      } as unknown as SocketTest,
      emitir,
    };
  }

  beforeEach(() => {
    seleccionarPedido = jest
      .fn()
      .mockResolvedValue([{ servicio: 'TEXTIL', ancho: 31 }]);
    obtenerSockets = jest.fn().mockResolvedValue([]);
    emitirEventoSala = jest.fn();
    emitirA = jest.fn().mockReturnValue({ emit: emitirEventoSala });

    const jwtService = {
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    const database = {
      db: {
        select: jest.fn().mockReturnValue({
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              limit: seleccionarPedido,
            }),
          }),
        }),
      },
    } as unknown as DatabaseService;
    gateway = new PedidosGateway(jwtService, database);
    gateway.server = {
      fetchSockets: obtenerSockets,
      to: emitirA,
      emit: jest.fn(),
    } as unknown as typeof gateway.server;
  });

  it('invita al área correcta y admite archivos mayores a 100 MB', async () => {
    const remitente = crearSocket('diseno', {
      id: 1,
      username: 'diseno',
      rol: 'DISENADOR',
      area: null,
    });
    const empleado31 = crearSocket('empleado-31', {
      id: 2,
      username: 'impresor31',
      rol: 'EMPLEADO',
      area: 'TEXTIL31',
    });
    const empleado58 = crearSocket('empleado-58', {
      id: 3,
      username: 'impresor58',
      rol: 'EMPLEADO',
      area: 'TEXTIL58',
    });
    obtenerSockets.mockResolvedValue([empleado31.socket, empleado58.socket]);

    const resultado = await gateway.invitarTransferencia(
      {
        pedidoId: 14,
        archivos: [
          {
            id: 'archivo-1',
            nombreArchivo: 'arte.pdf',
            tamano: 150 * 1024 * 1024,
            tipo: 'application/pdf',
          },
          {
            id: 'archivo-2',
            nombreArchivo: 'referencia.png',
            tamano: 10,
            tipo: 'image/png',
          },
        ],
      },
      remitente.socket,
    );

    expect(resultado).toMatchObject({
      ok: true,
      destinatarios: [{ socketId: 'empleado-31', username: 'impresor31' }],
    });
    expect(empleado31.emitir).toHaveBeenCalledWith(
      'transferencia:solicitud',
      expect.objectContaining({
        pedidoId: 14,
        remitente: 'diseno',
      }),
    );
    expect(empleado31.emitir).toHaveBeenCalledTimes(1);
    const primeraLlamada: unknown = empleado31.emitir.mock.calls[0];
    const solicitud: unknown = Reflect.get(primeraLlamada ?? {}, 1);
    expect(solicitud).toMatchObject({
      archivos: [
        { nombreArchivo: 'arte.pdf', tamano: 150 * 1024 * 1024 },
        { nombreArchivo: 'referencia.png', tamano: 10 },
      ],
    });
    expect(empleado58.emitir).not.toHaveBeenCalled();
  });

  it('impide que un empleado inicie transferencias', async () => {
    const empleado = crearSocket('empleado', {
      id: 2,
      username: 'impresor',
      rol: 'EMPLEADO',
      area: 'TEXTIL31',
    });

    const resultado = await gateway.invitarTransferencia(
      {
        pedidoId: 14,
        archivos: [
          {
            id: 'archivo-1',
            nombreArchivo: 'arte.pdf',
            tamano: 0,
            tipo: 'application/pdf',
          },
        ],
      },
      empleado.socket,
    );

    expect(resultado).toEqual({
      ok: false,
      error: 'Solo diseño o administración puede enviar archivos.',
    });
    expect(seleccionarPedido).not.toHaveBeenCalled();
  });

  it('apila tres solicitudes simultáneas para un mismo empleado', async () => {
    const empleado = crearSocket('empleado-31', {
      id: 2,
      username: 'impresor31',
      rol: 'EMPLEADO',
      area: 'TEXTIL31',
    });
    obtenerSockets.mockResolvedValue([empleado.socket]);

    const invitaciones = await Promise.all(
      [1, 2, 3].map((numero) =>
        gateway.invitarTransferencia(
          {
            pedidoId: 14,
            archivos: [
              {
                id: `archivo-${numero}`,
                nombreArchivo: `pedido-${numero}.pdf`,
                tamano: numero,
                tipo: 'application/pdf',
              },
            ],
          },
          crearSocket(`diseno-${numero}`, {
            id: numero,
            username: `diseno-${numero}`,
            rol: 'DISENADOR',
            area: null,
          }).socket,
        ),
      ),
    );

    expect(invitaciones.every((invitacion) => invitacion.ok)).toBe(true);
    expect(empleado.emitir).toHaveBeenCalledTimes(3);

    for (const invitacion of invitaciones) {
      if (!invitacion.ok) continue;
      expect(
        gateway.responderTransferencia(
          {
            transferenciaId: invitacion.transferenciaId,
            aceptada: true,
          },
          empleado.socket,
        ),
      ).toEqual({ ok: true });
    }
  });

  it('retransmite bloques aceptados y completa sin persistirlos', async () => {
    const remitente = crearSocket('diseno', {
      id: 1,
      username: 'diseno',
      rol: 'ADMIN',
      area: null,
    });
    const empleado = crearSocket('empleado-31', {
      id: 2,
      username: 'impresor31',
      rol: 'EMPLEADO',
      area: 'TEXTIL31',
    });
    obtenerSockets.mockResolvedValue([empleado.socket]);

    const invitacion = await gateway.invitarTransferencia(
      {
        pedidoId: 14,
        archivos: [
          {
            id: 'archivo-1',
            nombreArchivo: 'arte.pdf',
            tamano: 3,
            tipo: 'application/pdf',
          },
        ],
      },
      remitente.socket,
    );
    if (!invitacion.ok) throw new Error(invitacion.error);

    expect(
      gateway.responderTransferencia(
        { transferenciaId: invitacion.transferenciaId, aceptada: true },
        empleado.socket,
      ),
    ).toEqual({ ok: true });

    expect(
      gateway.enviarBloque(
        {
          transferenciaId: invitacion.transferenciaId,
          archivoId: 'archivo-1',
          secuencia: 0,
          contenido: new Uint8Array([1, 2, 3]),
        },
        remitente.socket,
      ),
    ).toEqual({ ok: true });
    expect(emitirA).toHaveBeenCalledWith('empleado-31');

    expect(
      gateway.completarTransferencia(
        {
          transferenciaId: invitacion.transferenciaId,
          archivoId: 'archivo-1',
        },
        remitente.socket,
      ),
    ).toEqual({ ok: true });

    expect(
      gateway.confirmarArchivoRecibido(
        {
          transferenciaId: invitacion.transferenciaId,
          archivoId: 'archivo-1',
        },
        empleado.socket,
      ),
    ).toEqual({ ok: true });
    expect(emitirEventoSala).toHaveBeenLastCalledWith(
      'transferencia:estado-destinatario',
      expect.objectContaining({
        archivoId: 'archivo-1',
        username: 'impresor31',
        estado: 'recibido',
      }),
    );
  });
});
