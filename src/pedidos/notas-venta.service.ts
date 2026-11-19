import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, inArray, like, lt, type SQL } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { clientes, notasVenta, pedidos } from '../database/schema';

const ESTADOS_PEDIDO_NOTA_NO_PAGADA = new Set([
  'REVISION',
  'IMPRIMIENDO',
  'LISTO',
  'ENTREGADO',
]);
const TAMANO_PAGINA_NOTAS = 10;

export interface NotaVentaDetalle {
  pedidoId: number;
  servicio: 'TEXTIL' | 'UV';
  ancho: number;
  largo: number | null;
  valor: number;
}

export interface NotaVentaRespuesta {
  numero: string;
  fecha: Date;
  cliente: {
    id: number;
    nombre: string;
  };
  pedidos: NotaVentaDetalle[];
  total: number;
}

export interface NotaVentaResumen {
  numero: string;
  fecha: Date;
  cliente: {
    id: number;
    nombre: string;
  };
  total: number;
}

export interface PaginaNotasVenta {
  notas: NotaVentaResumen[];
  siguienteCursor: number | null;
}

@Injectable()
export class NotasVentaService {
  private colaEmisiones = Promise.resolve();

  constructor(private readonly database: DatabaseService) {}

  async emitir(
    pedidoIds: number[],
    idempotencyKey: string,
  ): Promise<NotaVentaRespuesta> {
    return this.encolarEmision(pedidoIds, idempotencyKey, false);
  }

  async emitirNoPagados(
    pedidoIds: number[],
    idempotencyKey: string,
  ): Promise<NotaVentaRespuesta> {
    return this.encolarEmision(pedidoIds, idempotencyKey, true);
  }

  async obtenerPagina(
    cursor?: number,
    nombre?: string,
  ): Promise<PaginaNotasVenta> {
    if (
      cursor !== undefined &&
      (!Number.isSafeInteger(cursor) || cursor <= 0)
    ) {
      throw new BadRequestException('El cursor del historial no es válido.');
    }

    const termino = nombre?.trim();
    if (termino && termino.length > 100) {
      throw new BadRequestException(
        'La búsqueda no puede superar los 100 caracteres.',
      );
    }

    const filtros: SQL[] = [];
    if (cursor !== undefined) filtros.push(lt(notasVenta.id, cursor));
    if (termino) {
      filtros.push(like(notasVenta.clienteNombre, `%${termino}%`));
    }

    const resultados = await this.database.db
      .select({
        id: notasVenta.id,
        clienteId: notasVenta.clienteId,
        clienteNombre: notasVenta.clienteNombre,
        total: notasVenta.total,
        createdAt: notasVenta.createdAt,
      })
      .from(notasVenta)
      .where(and(...filtros))
      .orderBy(desc(notasVenta.id))
      .limit(TAMANO_PAGINA_NOTAS + 1);

    const hayMas = resultados.length > TAMANO_PAGINA_NOTAS;
    const notasPagina = resultados.slice(0, TAMANO_PAGINA_NOTAS);
    const ultimaNota = notasPagina.at(-1);
    return {
      notas: notasPagina.map((nota) => ({
        numero: String(nota.id).padStart(6, '0'),
        fecha: nota.createdAt,
        cliente: {
          id: nota.clienteId,
          nombre: nota.clienteNombre,
        },
        total: nota.total,
      })),
      siguienteCursor: hayMas ? (ultimaNota?.id ?? null) : null,
    };
  }

  async obtenerPorId(id: number): Promise<NotaVentaRespuesta> {
    const notas = await this.database.db
      .select()
      .from(notasVenta)
      .where(eq(notasVenta.id, id))
      .limit(1);
    const nota = notas[0];
    if (!nota) throw new NotFoundException('Nota de venta no encontrada.');
    return this.formatearNota(nota);
  }

  private encolarEmision(
    pedidoIds: number[],
    idempotencyKey: string,
    validarPedidosNoPagados: boolean,
  ): Promise<NotaVentaRespuesta> {
    if (
      pedidoIds.length === 0 ||
      new Set(pedidoIds).size !== pedidoIds.length
    ) {
      throw new BadRequestException('Selecciona pedidos válidos para la nota.');
    }

    const emision = this.colaEmisiones.then(() =>
      this.emitirEnTransaccion(
        pedidoIds,
        idempotencyKey,
        validarPedidosNoPagados,
      ),
    );
    this.colaEmisiones = emision.then(
      () => undefined,
      () => undefined,
    );
    return emision;
  }

  private async emitirEnTransaccion(
    pedidoIds: number[],
    idempotencyKey: string,
    validarPedidosNoPagados: boolean,
  ): Promise<NotaVentaRespuesta> {
    return this.database.db.transaction(async (tx) => {
      const notaExistente = await tx
        .select()
        .from(notasVenta)
        .where(eq(notasVenta.claveSolicitud, idempotencyKey))
        .limit(1);
      if (notaExistente[0]) {
        const nota = this.formatearNota(notaExistente[0]);
        this.validarPedidosSolicitados(nota.pedidos, pedidoIds);
        return nota;
      }

      const registros = await tx
        .select({
          pedidoId: pedidos.id,
          clienteId: clientes.id,
          clienteNombre: clientes.nombre,
          estado: pedidos.estado,
          estadoPago: pedidos.estadoPago,
          servicio: pedidos.servicio,
          ancho: pedidos.ancho,
          largo: pedidos.largo,
          valorCobrar: pedidos.valorCobrar,
          precioEspecial: pedidos.precioEspecial,
          precioCalculado: pedidos.precioCalculado,
        })
        .from(pedidos)
        .innerJoin(clientes, eq(pedidos.clienteId, clientes.id))
        .where(inArray(pedidos.id, pedidoIds));

      if (registros.length !== pedidoIds.length) {
        throw new BadRequestException(
          'Uno o más pedidos seleccionados ya no existen.',
        );
      }

      const registrosPorId = new Map(
        registros.map((registro) => [registro.pedidoId, registro]),
      );
      const ordenados = pedidoIds.map((id) => {
        const registro = registrosPorId.get(id);
        if (!registro) {
          throw new BadRequestException(
            'Uno o más pedidos seleccionados ya no existen.',
          );
        }
        return registro;
      });

      const primerPedido = ordenados[0];
      if (!primerPedido) {
        throw new BadRequestException('Selecciona al menos un pedido.');
      }

      if (
        ordenados.some(
          (registro) => registro.clienteId !== primerPedido.clienteId,
        )
      ) {
        throw new BadRequestException(
          'La nota de venta solo puede incluir pedidos de un mismo cliente.',
        );
      }

      if (
        validarPedidosNoPagados &&
        ordenados.some(
          (registro) =>
            registro.estadoPago !== 'NO_PAGADO' ||
            !ESTADOS_PEDIDO_NOTA_NO_PAGADA.has(registro.estado),
        )
      ) {
        throw new BadRequestException(
          'Solo se pueden incluir pedidos no pagados en revisión, imprimiendo, listos o entregados.',
        );
      }

      const detalle: NotaVentaDetalle[] = ordenados.map((registro) => {
        const valor =
          registro.valorCobrar ??
          registro.precioEspecial ??
          registro.precioCalculado;
        if (valor === null || !Number.isFinite(valor)) {
          throw new BadRequestException(
            `El pedido #${registro.pedidoId} no tiene un precio confirmado.`,
          );
        }
        if (registro.servicio !== 'TEXTIL' && registro.servicio !== 'UV') {
          throw new BadRequestException(
            `El pedido #${registro.pedidoId} tiene un servicio no válido.`,
          );
        }

        return {
          pedidoId: registro.pedidoId,
          servicio: registro.servicio,
          ancho: registro.ancho,
          largo: registro.largo,
          valor,
        };
      });
      const total =
        detalle.reduce((suma, item) => suma + Math.round(item.valor * 100), 0) /
        100;

      const insertados = await tx
        .insert(notasVenta)
        .values({
          claveSolicitud: idempotencyKey,
          clienteId: primerPedido.clienteId,
          clienteNombre: primerPedido.clienteNombre,
          pedidosJson: JSON.stringify(detalle),
          total,
        })
        .returning();
      const notaCreada = insertados[0];
      if (!notaCreada) {
        throw new ConflictException(
          'No se pudo asignar el número de la nota de venta. Inténtalo de nuevo.',
        );
      }
      const nota = this.formatearNota(notaCreada);
      this.validarPedidosSolicitados(nota.pedidos, pedidoIds);
      return nota;
    });
  }

  private validarPedidosSolicitados(
    detalle: NotaVentaDetalle[],
    pedidoIds: number[],
  ): void {
    const idsGuardados = detalle
      .map((item) => item.pedidoId)
      .sort((a, b) => a - b);
    const idsSolicitados = [...pedidoIds].sort((a, b) => a - b);
    if (
      idsGuardados.length !== idsSolicitados.length ||
      idsGuardados.some((id, indice) => id !== idsSolicitados[indice])
    ) {
      throw new ConflictException(
        'La clave de solicitud ya fue utilizada para otra selección de pedidos.',
      );
    }
  }

  private formatearNota(
    nota: typeof notasVenta.$inferSelect,
  ): NotaVentaRespuesta {
    const detalle = JSON.parse(nota.pedidosJson) as NotaVentaDetalle[];
    return {
      numero: String(nota.id).padStart(6, '0'),
      fecha: nota.createdAt,
      cliente: {
        id: nota.clienteId,
        nombre: nota.clienteNombre,
      },
      pedidos: detalle,
      total: nota.total,
    };
  }
}
