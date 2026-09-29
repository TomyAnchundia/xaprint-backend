import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';

import {
  clientes,
  historialPedidos,
  pagos,
  pagosPedidos,
  pedidos,
  usuarios,
} from '../database/schema';

import { CrearPagoDto } from './dto/crear-pago-dto';

@Injectable()
export class PagosService {
  constructor(private readonly database: DatabaseService) {}

  registrarPagoPedido(usuarioId: number, pedidoId: number) {
    return this.database.db.transaction(async (tx) => {
      const pedido = (
        await tx
          .select({
            id: pedidos.id,
            clienteId: pedidos.clienteId,
            estado: pedidos.estado,
            estadoPago: pedidos.estadoPago,
            valorCobrar: pedidos.valorCobrar,
          })
          .from(pedidos)
          .where(eq(pedidos.id, pedidoId))
          .limit(1)
          .all()
      )[0];

      if (!pedido) {
        throw new NotFoundException('Pedido no encontrado');
      }
      if (pedido.estado !== 'ENTREGADO') {
        throw new BadRequestException(
          'Solo se puede registrar el pago de un pedido entregado',
        );
      }

      const [resumen] = await tx
        .select({
          pagado: sql<number>`COALESCE(SUM(${pagosPedidos.monto}), 0)`,
        })
        .from(pagosPedidos)
        .where(eq(pagosPedidos.pedidoId, pedidoId))
        .all();

      const total = Number(pedido.valorCobrar ?? 0);
      const pagado = Number(resumen?.pagado ?? 0);
      const pendiente = Number(Math.max(total - pagado, 0).toFixed(2));

      if (pendiente <= 0) {
        throw new BadRequestException('El pedido ya está pagado');
      }

      const pago = (
        await tx
          .insert(pagos)
          .values({
            clienteId: pedido.clienteId,
            monto: pendiente,
            usuarioId,
          })
          .returning({ id: pagos.id })
          .all()
      )[0];

      await tx
        .insert(pagosPedidos)
        .values({ pagoId: pago.id, pedidoId, monto: pendiente })
        .run();

      await tx
        .update(pedidos)
        .set({ estadoPago: 'PAGADO', updatedAt: new Date() })
        .where(eq(pedidos.id, pedidoId))
        .run();

      await tx
        .insert(historialPedidos)
        .values({
          pedidoId,
          usuarioId,
          estadoAnterior: null,
          estadoNuevo: null,
          estadoPagoAnterior: pedido.estadoPago,
          estadoPagoNuevo: 'PAGADO',
        })
        .run();

      return {
        pagoId: pago.id,
        pedidoId,
        monto: pendiente,
        estadoPago: 'PAGADO',
      };
    });
  }

  revertirUltimoPagoPedido(usuarioId: number, pedidoId: number) {
    return this.database.db.transaction(async (tx) => {
      const pedido = (
        await tx
          .select({
            id: pedidos.id,
            estadoPago: pedidos.estadoPago,
            valorCobrar: pedidos.valorCobrar,
          })
          .from(pedidos)
          .where(eq(pedidos.id, pedidoId))
          .limit(1)
          .all()
      )[0];

      if (!pedido) {
        throw new NotFoundException('Pedido no encontrado');
      }

      const ultimoPago = (
        await tx
          .select({
            pagoId: pagos.id,
            montoPago: pagos.monto,
            montoAplicado: pagosPedidos.monto,
          })
          .from(pagosPedidos)
          .innerJoin(pagos, eq(pagosPedidos.pagoId, pagos.id))
          .where(eq(pagosPedidos.pedidoId, pedidoId))
          .orderBy(desc(pagos.createdAt), desc(pagos.id))
          .limit(1)
          .all()
      )[0];

      if (!ultimoPago) {
        throw new BadRequestException('No hay un pago que se pueda revertir');
      }

      const aplicacionesPago = await tx
        .select({ pedidoId: pagosPedidos.pedidoId })
        .from(pagosPedidos)
        .where(eq(pagosPedidos.pagoId, ultimoPago.pagoId))
        .all();

      if (
        aplicacionesPago.length !== 1 ||
        Number(ultimoPago.montoPago.toFixed(2)) !==
          Number(ultimoPago.montoAplicado.toFixed(2))
      ) {
        throw new BadRequestException(
          'Este pago se aplicó a varios pedidos y no se puede revertir desde el detalle individual',
        );
      }

      await tx
        .delete(pagosPedidos)
        .where(eq(pagosPedidos.pagoId, ultimoPago.pagoId))
        .run();
      await tx.delete(pagos).where(eq(pagos.id, ultimoPago.pagoId)).run();

      const [resumen] = await tx
        .select({
          pagado: sql<number>`COALESCE(SUM(${pagosPedidos.monto}), 0)`,
        })
        .from(pagosPedidos)
        .where(eq(pagosPedidos.pedidoId, pedidoId))
        .all();

      const pagadoActual = Number(resumen?.pagado ?? 0);
      const total = Number(pedido.valorCobrar ?? 0);
      const estadoPagoNuevo =
        pagadoActual >= total
          ? 'PAGADO'
          : pagadoActual > 0
            ? 'PARCIALMENTE_PAGADO'
            : 'NO_PAGADO';

      await tx
        .update(pedidos)
        .set({ estadoPago: estadoPagoNuevo, updatedAt: new Date() })
        .where(eq(pedidos.id, pedidoId))
        .run();

      await tx
        .insert(historialPedidos)
        .values({
          pedidoId,
          usuarioId,
          estadoAnterior: null,
          estadoNuevo: null,
          estadoPagoAnterior: pedido.estadoPago,
          estadoPagoNuevo,
        })
        .run();

      return {
        pedidoId,
        pagoRevertido: ultimoPago.pagoId,
        monto: Number(ultimoPago.montoAplicado.toFixed(2)),
        estadoPago: estadoPagoNuevo,
      };
    });
  }

  async obtenerDeudasClientes() {
    const filas = await this.database.db
      .select({
        clienteId: clientes.id,
        nombre: clientes.nombre,
        telefono: clientes.telefono,
        pedidoId: pedidos.id,
        valorCobrar: pedidos.valorCobrar,
        pagado: sql<number>`COALESCE(SUM(${pagosPedidos.monto}), 0)`,
      })
      .from(clientes)
      .leftJoin(
        pedidos,
        and(
          eq(pedidos.clienteId, clientes.id),
          eq(pedidos.estado, 'ENTREGADO'),
        ),
      )
      .leftJoin(pagosPedidos, eq(pedidos.id, pagosPedidos.pedidoId))
      .groupBy(
        clientes.id,
        clientes.nombre,
        clientes.telefono,
        pedidos.id,
        pedidos.valorCobrar,
      );

    const resumenes = new Map<
      number,
      {
        cliente: { id: number; nombre: string; telefono: string | null };
        pedidosConDeuda: number;
        totalDeuda: number;
      }
    >();

    for (const fila of filas) {
      let resumen = resumenes.get(fila.clienteId);
      if (!resumen) {
        resumen = {
          cliente: {
            id: fila.clienteId,
            nombre: fila.nombre,
            telefono: fila.telefono,
          },
          pedidosConDeuda: 0,
          totalDeuda: 0,
        };
        resumenes.set(fila.clienteId, resumen);
      }

      if (fila.pedidoId !== null) {
        const saldo = Math.max(
          (fila.valorCobrar ?? 0) - Number(fila.pagado ?? 0),
          0,
        );
        if (saldo > 0) {
          resumen.pedidosConDeuda += 1;
          resumen.totalDeuda += saldo;
        }
      }
    }

    return Array.from(resumenes.values()).map((resumen) => ({
      ...resumen,
      totalDeuda: Number(resumen.totalDeuda.toFixed(2)),
    }));
  }

  async obtenerResumen(fecha: string) {
    const { inicio, fin } = this.obtenerRangoDia(fecha);

    const [cobros] = await this.database.db
      .select({
        total: sql<number>`COALESCE(SUM(${pagos.monto}), 0)`,
      })
      .from(pagos)
      .where(and(gte(pagos.createdAt, inicio), lt(pagos.createdAt, fin)));

    const pedidosEntregados = await this.database.db
      .select({
        total: pedidos.valorCobrar,
        pagado: sql<number>`COALESCE(SUM(${pagosPedidos.monto}), 0)`,
      })
      .from(pedidos)
      .leftJoin(pagosPedidos, eq(pedidos.id, pagosPedidos.pedidoId))
      .where(eq(pedidos.estado, 'ENTREGADO'))
      .groupBy(pedidos.id, pedidos.valorCobrar);

    const porCobrar = pedidosEntregados.reduce((total, pedido) => {
      const valorCobrar = pedido.total ?? 0;

      const saldo = Math.max(valorCobrar - Number(pedido.pagado ?? 0), 0);

      return total + saldo;
    }, 0);

    /*
     * Aporte desarrollador acumulado.
     *
     * Se suma únicamente de pedidos completamente pagados.
     * No depende de la fecha seleccionada.
     */
    const pedidosConAporte = await this.database.db
      .select({
        aporteDesarrollador: pedidos.aporteDesarrollador,
        valorCobrar: pedidos.valorCobrar,
        pagado: sql<number>`COALESCE(SUM(${pagosPedidos.monto}), 0)`,
      })
      .from(pedidos)
      .leftJoin(pagosPedidos, eq(pedidos.id, pagosPedidos.pedidoId))
      .groupBy(pedidos.id, pedidos.aporteDesarrollador, pedidos.valorCobrar);

    const aporteDesarrolladorAcumulado = pedidosConAporte.reduce(
      (total, pedido) => {
        const valorCobrar = Number(pedido.valorCobrar ?? 0);
        const pagado = Number(pedido.pagado ?? 0);

        const estaPagado = valorCobrar > 0 && pagado >= valorCobrar;

        if (!estaPagado) {
          return total;
        }

        return total + Number(pedido.aporteDesarrollador ?? 0);
      },
      0,
    );

    return {
      fecha,

      cobradoHoy: Number(Number(cobros?.total ?? 0).toFixed(2)),

      porCobrar: Number(porCobrar.toFixed(2)),

      pedidosPorCobrar: pedidosEntregados.filter(
        (pedido) => (pedido.total ?? 0) - Number(pedido.pagado ?? 0) > 0,
      ).length,

      aporteDesarrolladorAcumulado: Number(
        aporteDesarrolladorAcumulado.toFixed(2),
      ),
    };
  }

  private obtenerRangoDia(fecha: string): { inicio: Date; fin: Date } {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);
    const calendario = new Date(Date.UTC(anio, mes - 1, dia));
    if (
      calendario.getUTCFullYear() !== anio ||
      calendario.getUTCMonth() !== mes - 1 ||
      calendario.getUTCDate() !== dia
    ) {
      throw new BadRequestException('La fecha no es válida');
    }

    const inicio = new Date(Date.UTC(anio, mes - 1, dia, 5));
    const fin = new Date(inicio);
    fin.setUTCDate(fin.getUTCDate() + 1);

    return { inicio, fin };
  }

  async obtenerDeudaCliente(clienteId: number) {
    const cliente = await this.database.db
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        telefono: clientes.telefono,
      })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);

    if (!cliente[0]) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const pedidosCliente = await this.database.db
      .select({
        id: pedidos.id,
        estado: pedidos.estado,
        valorCobrar: pedidos.valorCobrar,
        pagado: sql<number>`
          COALESCE(SUM(${pagosPedidos.monto}), 0)
        `,
      })
      .from(pedidos)
      .leftJoin(pagosPedidos, eq(pedidos.id, pagosPedidos.pedidoId))
      .where(
        and(eq(pedidos.clienteId, clienteId), eq(pedidos.estado, 'ENTREGADO')),
      )
      .groupBy(pedidos.id, pedidos.estado, pedidos.valorCobrar);

    const pedidosConDeuda = pedidosCliente
      .map((pedido) => {
        const total = Number((pedido.valorCobrar ?? 0).toFixed(2));

        const pagado = Number(Number(pedido.pagado ?? 0).toFixed(2));

        const porCobrar = Number((total - pagado).toFixed(2));

        return {
          id: pedido.id,
          total,
          pagado,
          porCobrar,
        };
      })
      .filter((pedido) => pedido.porCobrar > 0);

    const totalDeuda = Number(
      pedidosConDeuda
        .reduce((total, pedido) => total + pedido.porCobrar, 0)
        .toFixed(2),
    );

    return {
      cliente: cliente[0],
      pedidos: pedidosConDeuda,
      totalDeuda,
    };
  }

  async registrarPago(usuarioId: number, dto: CrearPagoDto) {
    const resultado = await this.database.db.transaction(async (tx) => {
      const cliente = await tx
        .select({
          id: clientes.id,
          nombre: clientes.nombre,
          telefono: clientes.telefono,
        })
        .from(clientes)
        .where(eq(clientes.id, dto.clienteId))
        .limit(1)
        .all();

      if (!cliente[0]) {
        throw new NotFoundException('Cliente no encontrado');
      }

      /*
       * Obtenemos los pedidos ENTREGADOS
       * y sus pagos reales.
       *
       * No mezclamos historialPedidos aquí
       * para evitar duplicar los SUM().
       */
      const pedidosCliente = await tx
        .select({
          id: pedidos.id,
          valorCobrar: pedidos.valorCobrar,

          pagado: sql<number>`
            COALESCE(
              SUM(${pagosPedidos.monto}),
              0
            )
          `,
        })
        .from(pedidos)
        .leftJoin(pagosPedidos, eq(pedidos.id, pagosPedidos.pedidoId))
        .where(
          and(
            eq(pedidos.clienteId, dto.clienteId),
            eq(pedidos.estado, 'ENTREGADO'),
          ),
        )
        .groupBy(pedidos.id, pedidos.valorCobrar)
        .all();

      /*
       * Obtenemos la fecha en que cada pedido
       * pasó a ENTREGADO.
       *
       * Usamos el timestamp directamente,
       * sin convertirlo a Date.
       */
      const fechasEntrega = await tx
        .select({
          pedidoId: historialPedidos.pedidoId,

          fechaEntrega: sql<number | null>`
            MAX(
              CASE
                WHEN ${historialPedidos.estadoNuevo} = 'ENTREGADO'
                THEN ${historialPedidos.createdAt}
              END
            )
          `,
        })
        .from(historialPedidos)
        .groupBy(historialPedidos.pedidoId)
        .all();

      const fechasEntregaMap = new Map<number, number | null>();

      for (const registro of fechasEntrega) {
        const fecha = registro.fechaEntrega;

        fechasEntregaMap.set(
          registro.pedidoId,
          fecha === null ? null : Number(fecha),
        );
      }

      /*
       * Calculamos la deuda real de cada pedido.
       */
      const pedidosConDeuda = pedidosCliente
        .map((pedido) => {
          const total = Number((pedido.valorCobrar ?? 0).toFixed(2));

          const pagado = Number(Number(pedido.pagado ?? 0).toFixed(2));

          const porCobrar = Number((total - pagado).toFixed(2));

          return {
            id: pedido.id,
            total,
            pagado,
            porCobrar,
            fechaEntrega: fechasEntregaMap.get(pedido.id) ?? null,
          };
        })
        .filter((pedido) => pedido.porCobrar > 0)
        .sort((a, b) => {
          /*
           * FIFO:
           * primero el pedido entregado más antiguo.
           */
          if (a.fechaEntrega === null && b.fechaEntrega === null) {
            return a.id - b.id;
          }

          if (a.fechaEntrega === null) {
            return 1;
          }

          if (b.fechaEntrega === null) {
            return -1;
          }

          if (a.fechaEntrega !== b.fechaEntrega) {
            return a.fechaEntrega - b.fechaEntrega;
          }

          return a.id - b.id;
        });

      const totalDeuda = Number(
        pedidosConDeuda
          .reduce((total, pedido) => total + pedido.porCobrar, 0)
          .toFixed(2),
      );

      const monto = Number(dto.monto.toFixed(2));

      if (monto <= 0) {
        throw new BadRequestException('El monto del abono debe ser mayor a 0');
      }

      if (monto > totalDeuda) {
        throw new BadRequestException(
          `El abono no puede superar la deuda total de $${totalDeuda.toFixed(2)}`,
        );
      }

      const pago = await tx
        .insert(pagos)
        .values({
          clienteId: dto.clienteId,
          monto,
          usuarioId,
        })
        .returning({
          id: pagos.id,
        })
        .all();

      let restante = monto;

      /*
       * Aplicamos FIFO.
       */
      for (const pedido of pedidosConDeuda) {
        if (restante <= 0) {
          break;
        }

        const montoAplicar = Number(
          Math.min(restante, pedido.porCobrar).toFixed(2),
        );

        /*
         * Relacionamos el pago
         * con el pedido.
         */
        await tx
          .insert(pagosPedidos)
          .values({
            pagoId: pago[0].id,
            pedidoId: pedido.id,
            monto: montoAplicar,
          })
          .run();

        /*
         * Calculamos cuánto lleva pagado
         * este pedido después del abono.
         */
        const nuevoPagado = Number((pedido.pagado + montoAplicar).toFixed(2));

        /*
         * Actualizamos estado de pago.
         */
        const nuevoEstadoPago =
          nuevoPagado >= pedido.total ? 'PAGADO' : 'PARCIALMENTE_PAGADO';

        const estadoPagoAnterior =
          pedido.pagado <= 0 ? 'NO_PAGADO' : 'PARCIALMENTE_PAGADO';

        await tx
          .update(pedidos)
          .set({
            estadoPago: nuevoEstadoPago,
            updatedAt: new Date(),
          })
          .where(eq(pedidos.id, pedido.id))
          .run();

        /*
         * Guardamos el cambio
         * en el historial.
         */
        await tx
          .insert(historialPedidos)
          .values({
            pedidoId: pedido.id,
            usuarioId,

            estadoAnterior: null,
            estadoNuevo: null,

            estadoPagoAnterior,
            estadoPagoNuevo: nuevoEstadoPago,
          })
          .run();

        restante = Number((restante - montoAplicar).toFixed(2));
      }

      return {
        pagoId: pago[0].id,
        cliente: cliente[0],
        monto,
        aplicado: Number((monto - restante).toFixed(2)),
      };
    });

    return resultado;
  }

  async obtenerPagosCliente(clienteId: number) {
    const cliente = await this.database.db
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        telefono: clientes.telefono,
      })
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);

    if (!cliente[0]) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const resultados = await this.database.db
      .select({
        pagoId: pagos.id,
        montoPago: pagos.monto,
        fechaPago: pagos.createdAt,

        usuarioId: pagos.usuarioId,
        usuario: usuarios.username,

        pedidoId: pagosPedidos.pedidoId,
        montoAplicado: pagosPedidos.monto,
      })
      .from(pagos)
      .innerJoin(pagosPedidos, eq(pagos.id, pagosPedidos.pagoId))
      .innerJoin(usuarios, eq(pagos.usuarioId, usuarios.id))
      .where(eq(pagos.clienteId, clienteId))
      .orderBy(asc(pagos.createdAt));

    const pagosMap = new Map<
      number,
      {
        id: number;
        monto: number;
        fecha: Date;
        usuario: {
          id: number;
          username: string;
        };
        aplicaciones: {
          pedidoId: number;
          monto: number;
        }[];
      }
    >();

    for (const resultado of resultados) {
      if (!pagosMap.has(resultado.pagoId)) {
        pagosMap.set(resultado.pagoId, {
          id: resultado.pagoId,

          monto: Number(resultado.montoPago.toFixed(2)),

          fecha: resultado.fechaPago,

          usuario: {
            id: resultado.usuarioId,
            username: resultado.usuario,
          },

          aplicaciones: [],
        });
      }

      pagosMap.get(resultado.pagoId)!.aplicaciones.push({
        pedidoId: resultado.pedidoId,

        monto: Number(resultado.montoAplicado.toFixed(2)),
      });
    }

    return {
      cliente: cliente[0],

      pagos: Array.from(pagosMap.values()),
    };
  }
}
