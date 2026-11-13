import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { eq, inArray } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { clientes, notasVenta, pedidos } from '../database/schema';

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

@Injectable()
export class NotasVentaService {
  private colaEmisiones = Promise.resolve();

  constructor(private readonly database: DatabaseService) {}

  async emitir(
    pedidoIds: number[],
    idempotencyKey: string,
  ): Promise<NotaVentaRespuesta> {
    if (
      pedidoIds.length === 0 ||
      new Set(pedidoIds).size !== pedidoIds.length
    ) {
      throw new BadRequestException('Selecciona pedidos válidos para la nota.');
    }

    const emision = this.colaEmisiones.then(() =>
      this.emitirEnTransaccion(pedidoIds, idempotencyKey),
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
  ): Promise<NotaVentaRespuesta> {
    return this.database.db.transaction(async (tx) => {
      const notaExistente = await tx
        .select()
        .from(notasVenta)
        .where(eq(notasVenta.claveSolicitud, idempotencyKey))
        .limit(1);
      if (notaExistente[0]) {
        return this.formatearNota(notaExistente[0], pedidoIds);
      }

      const registros = await tx
        .select({
          pedidoId: pedidos.id,
          clienteId: clientes.id,
          clienteNombre: clientes.nombre,
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
      return this.formatearNota(notaCreada, pedidoIds);
    });
  }

  private formatearNota(
    nota: typeof notasVenta.$inferSelect,
    pedidoIds: number[],
  ): NotaVentaRespuesta {
    const detalle = JSON.parse(nota.pedidosJson) as NotaVentaDetalle[];
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
