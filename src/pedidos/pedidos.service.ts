import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { desc, eq, max, or } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  clientes,
  historialPedidos,
  pagosPedidos,
  pedidos,
  usuarios,
} from '../database/schema';
import { PreciosService } from '../precios/precios.service';
import { ActualizarPedidoDto } from './dto/actualizar-pedido.dto';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { PedidosGateway } from './pedidos.gateway';
export const ESTADOS_PEDIDO = [
  'REVISION',
  'IMPRIMIENDO',
  'LISTO',
  'ENTREGADO',
  'CANCELADO',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
type PedidoConsulta = {
  id: number;
  clienteId: number | null;
  clienteNombre: string | null;
  clienteTelefono: string | null;
  clienteTarifaEspecial: boolean | null;
  estado: string;
  estadoPago: string;
  prioridad: number;
  servicio: string;
  ancho: number;
  largo: number | null;
  precioCalculado: number | null;
  precioEspecial: number | null;
  aporteDesarrollador: number | null;
  valorCobrar: number | null;
  costoDiseno: number;
  precioEspecialUsuarioId: number | null;
  precioEspecialFecha: Date | null;
  contraer: boolean | null;
  velocidad: number | null;
  obturacion: boolean | null;
  observaciones: string | null;
  fechaEntrega: Date | null;
  createdAt: Date;
  updatedAt: Date;
  fechaUltimoCambioEstado: Date | null;
};
@Injectable()
export class PedidosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly pedidosGateway: PedidosGateway,
    private readonly preciosService: PreciosService,
  ) {}
  async obtenerTodos() {
    const ultimoCambioEstado = this.database.db
      .select({
        pedidoId: historialPedidos.pedidoId,
        fechaUltimoCambioEstado: max(historialPedidos.createdAt).as(
          'fechaUltimoCambioEstado',
        ),
      })
      .from(historialPedidos)
      .groupBy(historialPedidos.pedidoId)
      .as('ultimoCambioEstado');
    const resultado = await this.database.db
      .select({
        id: pedidos.id,
        clienteId: clientes.id,
        clienteNombre: clientes.nombre,
        clienteTelefono: clientes.telefono,
        clienteTarifaEspecial: clientes.tarifaEspecial,
        estado: pedidos.estado,
        estadoPago: pedidos.estadoPago,
        prioridad: pedidos.prioridad,
        servicio: pedidos.servicio,
        ancho: pedidos.ancho,
        largo: pedidos.largo,
        precioCalculado: pedidos.precioCalculado,
        precioEspecial: pedidos.precioEspecial,
        aporteDesarrollador: pedidos.aporteDesarrollador,
        valorCobrar: pedidos.valorCobrar,
        costoDiseno: pedidos.costoDiseno,
        precioEspecialUsuarioId: pedidos.precioEspecialUsuarioId,
        precioEspecialFecha: pedidos.precioEspecialFecha,
        contraer: pedidos.contraer,
        velocidad: pedidos.velocidad,
        obturacion: pedidos.obturacion,
        observaciones: pedidos.observaciones,
        fechaEntrega: pedidos.fechaEntrega,
        createdAt: pedidos.createdAt,
        updatedAt: pedidos.updatedAt,
        fechaUltimoCambioEstado: ultimoCambioEstado.fechaUltimoCambioEstado,
      })
      .from(pedidos)
      .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .leftJoin(
        ultimoCambioEstado,
        eq(pedidos.id, ultimoCambioEstado.pedidoId),
      )
      .orderBy(desc(pedidos.createdAt), desc(pedidos.id));
    return resultado.map((pedido) => this.formatearPedido(pedido));
  }
  async buscarPorId(id: number) {
    const ultimoCambioEstado = this.database.db
      .select({
        pedidoId: historialPedidos.pedidoId,
        fechaUltimoCambioEstado: max(historialPedidos.createdAt).as(
          'fechaUltimoCambioEstado',
        ),
      })
      .from(historialPedidos)
      .groupBy(historialPedidos.pedidoId)
      .as('ultimoCambioEstado');
    const resultado = await this.database.db
      .select({
        id: pedidos.id,
        clienteId: clientes.id,
        clienteNombre: clientes.nombre,
        clienteTelefono: clientes.telefono,
        clienteTarifaEspecial: clientes.tarifaEspecial,
        estado: pedidos.estado,
        estadoPago: pedidos.estadoPago,
        prioridad: pedidos.prioridad,
        servicio: pedidos.servicio,
        ancho: pedidos.ancho,
        largo: pedidos.largo,
        precioCalculado: pedidos.precioCalculado,
        precioEspecial: pedidos.precioEspecial,
        aporteDesarrollador: pedidos.aporteDesarrollador,
        valorCobrar: pedidos.valorCobrar,
        costoDiseno: pedidos.costoDiseno,
        precioEspecialUsuarioId: pedidos.precioEspecialUsuarioId,
        precioEspecialFecha: pedidos.precioEspecialFecha,
        contraer: pedidos.contraer,
        velocidad: pedidos.velocidad,
        obturacion: pedidos.obturacion,
        observaciones: pedidos.observaciones,
        fechaEntrega: pedidos.fechaEntrega,
        createdAt: pedidos.createdAt,
        updatedAt: pedidos.updatedAt,
        fechaUltimoCambioEstado: ultimoCambioEstado.fechaUltimoCambioEstado,
      })
      .from(pedidos)
      .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .leftJoin(ultimoCambioEstado, eq(pedidos.id, ultimoCambioEstado.pedidoId))
      .where(eq(pedidos.id, id))
      .limit(1);
    const pedido = resultado[0];
    if (!pedido) {
      return null;
    }
    return this.formatearPedido(pedido);
  }
  async crear(datos: CrearPedidoDto) {
    const precioCalculado = await this.calcularPrecioSiCorresponde(
      datos.servicio,
      datos.ancho,
      datos.largo,
      datos.clienteId,
    );
    const costoDiseno = datos.costoDiseno ?? 0;
    const valoresPrecio = this.calcularValoresPrecio(
      datos.servicio,
      datos.ancho,
      datos.largo,
      precioCalculado,
      null,
      costoDiseno,
    );
    const resultado = await this.database.db
      .insert(pedidos)
      .values({
        clienteId: datos.clienteId,
        estado: 'REVISION',
        prioridad: datos.prioridad ?? 0,
        servicio: datos.servicio,
        ancho: datos.ancho,
        largo: datos.largo,
        precioCalculado,
        precioEspecial: null,
        aporteDesarrollador: valoresPrecio.aporteDesarrollador,
        valorCobrar: valoresPrecio.valorCobrar,
        costoDiseno,
        contraer: datos.contraer ?? null,
        velocidad: datos.velocidad ?? null,
        obturacion: datos.obturacion ?? null,
        observaciones: datos.observaciones ?? null,
        fechaEntrega: datos.fechaEntrega ? new Date(datos.fechaEntrega) : null,
      })
      .returning();
    const pedidoCreado = resultado[0];
    const pedidoFormateado = await this.buscarPorId(pedidoCreado.id);
    this.pedidosGateway.emitirPedidoActualizado(pedidoFormateado);
    return pedidoFormateado;
  }
  async actualizar(id: number, datos: ActualizarPedidoDto) {
    const pedidoActual = await this.buscarPorId(id);
    if (!pedidoActual) {
      throw new NotFoundException('Pedido no encontrado');
    }
    const servicioNuevo = datos.servicio ?? pedidoActual.servicio;
    const anchoNuevo = datos.ancho ?? pedidoActual.ancho;
    const largoNuevo =
      datos.largo !== undefined ? datos.largo : pedidoActual.largo;
    const costoDisenoNuevo =
      datos.costoDiseno !== undefined
        ? datos.costoDiseno
        : pedidoActual.costoDiseno;
    const cambioCliente =
      datos.clienteId !== undefined &&
      datos.clienteId !== pedidoActual.cliente?.id;
    const debeRecalcularPrecio =
      cambioCliente ||
      datos.servicio !== undefined ||
      datos.ancho !== undefined ||
      datos.largo !== undefined;
    let precioCalculado = pedidoActual.precioCalculado;
    let aporteDesarrollador = pedidoActual.aporteDesarrollador ?? 0;
    let valorCobrar = pedidoActual.valorCobrar;
    /* * Si cambia servicio, ancho o largo: * se recalcula el precio de impresión. */ if (
      debeRecalcularPrecio &&
      largoNuevo !== null
    ) {
      precioCalculado = await this.calcularPrecioSiCorresponde(
        servicioNuevo,
        anchoNuevo,
        largoNuevo,
        datos.clienteId ?? pedidoActual.cliente?.id,
      );
      const valoresPrecio = this.calcularValoresPrecio(
        servicioNuevo,
        anchoNuevo,
        largoNuevo,
        precioCalculado,
        pedidoActual.precioEspecial,
        costoDisenoNuevo,
      );
      aporteDesarrollador = valoresPrecio.aporteDesarrollador;
      valorCobrar = valoresPrecio.valorCobrar;
    }
    /* * Si solamente cambia costoDiseno, * también debemos recalcular valorCobrar. * * El aporte del desarrollador NO cambia * por el costo del diseño. */ if (
      datos.costoDiseno !== undefined &&
      !debeRecalcularPrecio
    ) {
      const valoresPrecio = this.calcularValoresPrecio(
        servicioNuevo,
        anchoNuevo,
        largoNuevo ?? 0,
        precioCalculado,
        pedidoActual.precioEspecial,
        costoDisenoNuevo,
      );
      aporteDesarrollador = valoresPrecio.aporteDesarrollador;
      valorCobrar = valoresPrecio.valorCobrar;
    }
    /* * El estado NO se modifica aquí. * * Todo cambio de estado debe pasar por * cambiarEstado() para garantizar que * quede registrado en el historial. */ await this.database.db
      .update(pedidos)
      .set({
        ...(datos.clienteId !== undefined && { clienteId: datos.clienteId }),
        ...(datos.servicio !== undefined && { servicio: datos.servicio }),
        ...(datos.ancho !== undefined && { ancho: datos.ancho }),
        ...(datos.largo !== undefined && { largo: datos.largo }),
        ...(debeRecalcularPrecio && {
          precioCalculado,
          aporteDesarrollador,
          valorCobrar,
        }),
        ...(datos.costoDiseno !== undefined && {
          costoDiseno: costoDisenoNuevo,
          /* * Si solo cambió costoDiseno, * necesitamos guardar el nuevo valorCobrar. */ ...(!debeRecalcularPrecio && {
            aporteDesarrollador,
            valorCobrar,
          }),
        }),
        ...(datos.contraer !== undefined && { contraer: datos.contraer }),
        ...(datos.velocidad !== undefined && { velocidad: datos.velocidad }),
        ...(datos.obturacion !== undefined && { obturacion: datos.obturacion }),
        ...(datos.observaciones !== undefined && {
          observaciones: datos.observaciones,
        }),
        ...(datos.prioridad !== undefined && { prioridad: datos.prioridad }),
        ...(datos.fechaEntrega !== undefined && {
          fechaEntrega: datos.fechaEntrega
            ? new Date(datos.fechaEntrega)
            : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(pedidos.id, id));
    const pedidoActualizado = await this.buscarPorId(id);
    this.pedidosGateway.emitirPedidoActualizado(pedidoActualizado);
    return pedidoActualizado;
  }
  async cambiarEstado(
    id: number,
    nuevoEstado: EstadoPedido,
    usuarioId: number,
  ) {
    const pedido = await this.buscarPorId(id);
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }
    this.validarEstado(nuevoEstado);
    const estadoActual = pedido.estado as EstadoPedido;
    if (estadoActual === nuevoEstado) {
      throw new BadRequestException(
        `El pedido ya se encuentra en ${nuevoEstado}`,
      );
    }
    const estadosPermitidos = this.obtenerEstadosPermitidos(estadoActual);
    if (!estadosPermitidos.includes(nuevoEstado)) {
      throw new BadRequestException(
        `No se puede cambiar el pedido de ${estadoActual} a ${nuevoEstado}`,
      );
    }
    await this.database.db
      .update(pedidos)
      .set({ estado: nuevoEstado, updatedAt: new Date() })
      .where(eq(pedidos.id, id));
    await this.database.db.insert(historialPedidos).values({
      pedidoId: id,
      usuarioId,
      estadoAnterior: estadoActual,
      estadoNuevo: nuevoEstado,
    });
    const pedidoActualizado = await this.buscarPorId(id);
    this.pedidosGateway.emitirPedidoActualizado(pedidoActualizado);
    return pedidoActualizado;
  }
  async cambiarPrecioEspecial(
    id: number,
    precioEspecial: number | null,
    usuarioId: number,
  ) {
    const pedido = await this.buscarPorId(id);
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }
    const costoDiseno = pedido.costoDiseno ?? 0;
    let aporteDesarrollador = 0;
    let valorCobrar: number | null = null;
    /* * Si existe precio especial: * * aporteDesarrollador = $0.05 * * El precio especial corresponde únicamente * a la impresión. * * El costo del diseño se suma aparte. */ if (
      precioEspecial !== null
    ) {
      aporteDesarrollador = 0.05;
      valorCobrar = this.redondear(precioEspecial + costoDiseno);
    } else if (pedido.largo !== null) {
      /* * Si se elimina el precio especial, * volvemos al precio normal. */ const valoresPrecio =
        this.calcularValoresPrecio(
          pedido.servicio,
          pedido.ancho,
          pedido.largo,
          pedido.precioCalculado,
          null,
          costoDiseno,
        );
      aporteDesarrollador = valoresPrecio.aporteDesarrollador;
      valorCobrar = valoresPrecio.valorCobrar;
    } else {
      valorCobrar = costoDiseno;
    }
    await this.database.db
      .update(pedidos)
      .set({
        precioEspecial,
        aporteDesarrollador,
        valorCobrar,
        precioEspecialUsuarioId: precioEspecial !== null ? usuarioId : null,
        precioEspecialFecha: precioEspecial !== null ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(pedidos.id, id));
    const pedidoActualizado = await this.buscarPorId(id);
    this.pedidosGateway.emitirPedidoActualizado(pedidoActualizado);
    return pedidoActualizado;
  }
  async obtenerHistorial(id: number) {
    const pedido = await this.buscarPorId(id);
    if (!pedido) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return this.database.db
      .select({
        id: historialPedidos.id,
        estadoAnterior: historialPedidos.estadoAnterior,
        estadoNuevo: historialPedidos.estadoNuevo,
        estadoPagoAnterior: historialPedidos.estadoPagoAnterior,
        estadoPagoNuevo: historialPedidos.estadoPagoNuevo,
        fecha: historialPedidos.createdAt,
        usuario: usuarios.username,
      })
      .from(historialPedidos)
      .leftJoin(usuarios, eq(historialPedidos.usuarioId, usuarios.id))
      .where(eq(historialPedidos.pedidoId, id))
      .orderBy(desc(historialPedidos.createdAt), desc(historialPedidos.id));
  }
  async eliminar(id: number) {
    const resultado = await this.database.db.transaction(async (tx) => {
      const pagosRegistrados = await tx
        .select({ id: pagosPedidos.id })
        .from(pagosPedidos)
        .where(eq(pagosPedidos.pedidoId, id))
        .limit(1)
        .all();

      if (pagosRegistrados.length > 0) {
        throw new BadRequestException(
          'No se puede eliminar un pedido que tiene pagos registrados',
        );
      }

      await tx
        .delete(historialPedidos)
        .where(eq(historialPedidos.pedidoId, id))
        .run();

      return tx.delete(pedidos).where(eq(pedidos.id, id)).returning().all();
    });

    if (!resultado[0]) {
      throw new NotFoundException('Pedido no encontrado');
    }
    this.pedidosGateway.emitirPedidoActualizado({ id, eliminado: true });
    return resultado[0];
  }
  private formatearPedido(pedido: PedidoConsulta) {
    return {
      id: pedido.id,
      cliente: pedido.clienteId
        ? {
            id: pedido.clienteId,
            nombre: pedido.clienteNombre,
            telefono: pedido.clienteTelefono,
            tarifaEspecial: pedido.clienteTarifaEspecial ?? false,
          }
        : null,
      estado: pedido.estado,
      estadoPago: pedido.estadoPago,
      prioridad: pedido.prioridad,
      servicio: pedido.servicio,
      ancho: pedido.ancho,
      largo: pedido.largo,
      precioCalculado: pedido.precioCalculado,
      precioEspecial: pedido.precioEspecial,
      costoDiseno: pedido.costoDiseno,
      aporteDesarrollador: pedido.aporteDesarrollador,
      valorCobrar: pedido.valorCobrar,
      /* * Se mantiene temporalmente por compatibilidad. * * La lógica nueva debe utilizar valorCobrar. */ precioFinal:
        pedido.precioEspecial ?? pedido.precioCalculado,
      precioEspecialUsuarioId: pedido.precioEspecialUsuarioId,
      precioEspecialFecha: pedido.precioEspecialFecha,
      contraer: pedido.contraer,
      velocidad: pedido.velocidad,
      obturacion: pedido.obturacion,
      observaciones: pedido.observaciones,
      fechaEntrega: pedido.fechaEntrega,
      createdAt: pedido.createdAt,
      updatedAt: pedido.updatedAt,
      /* * Si todavía no existe historial, * el pedido acaba de ser creado en REVISION, * por lo que usamos createdAt como referencia. */ fechaUltimoCambioEstado:
        pedido.fechaUltimoCambioEstado ?? pedido.createdAt,
    };
  }
  private calcularValoresPrecio(
    servicio: string,
    ancho: number,
    largoCm: number,
    precioCalculado: number | null,
    precioEspecial: number | null,
    costoDiseno: number = 0,
  ) {
    return this.preciosService.calcularCotizacionDesdePrecio(
      precioCalculado,
      precioEspecial,
      costoDiseno,
    );
  }
  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }
  private async calcularPrecioSiCorresponde(
    servicio: string,
    ancho: number,
    largoCm: number | null | undefined,
    clienteId?: number,
  ): Promise<number | null> {
    if (largoCm === null || largoCm === undefined) {
      return null;
    }
    return await this.preciosService.calcularPrecio(
      servicio as 'TEXTIL' | 'UV',
      ancho,
      largoCm,
      clienteId,
    );
  }
  private validarEstado(estado: string): void {
    if (!ESTADOS_PEDIDO.includes(estado as EstadoPedido)) {
      throw new BadRequestException(`Estado de pedido no válido: ${estado}`);
    }
  }
  private obtenerEstadosPermitidos(estado: EstadoPedido): EstadoPedido[] {
    const flujo: Record<EstadoPedido, EstadoPedido[]> = {
      REVISION: ['IMPRIMIENDO', 'CANCELADO'],
      IMPRIMIENDO: ['REVISION', 'LISTO', 'CANCELADO'],
      LISTO: ['IMPRIMIENDO', 'ENTREGADO', 'CANCELADO'],
      ENTREGADO: ['LISTO'],
      CANCELADO: [],
    };
    return flujo[estado];
  }
  async obtenerHistorialGeneral() {
    const historial = await this.database.db
      .select({
        id: historialPedidos.id,
        pedidoId: historialPedidos.pedidoId,
        estadoAnterior: historialPedidos.estadoAnterior,
        estado: historialPedidos.estadoNuevo,
        estadoPago: pedidos.estadoPago,
        fecha: historialPedidos.createdAt,
        clienteId: clientes.id,
        clienteNombre: clientes.nombre,
        clienteTelefono: clientes.telefono,
        servicio: pedidos.servicio,
        ancho: pedidos.ancho,
        largo: pedidos.largo,
        precioCalculado: pedidos.precioCalculado,
        precioEspecial: pedidos.precioEspecial,
        costoDiseno: pedidos.costoDiseno,
        aporteDesarrollador: pedidos.aporteDesarrollador,
        valorCobrar: pedidos.valorCobrar,
        prioridad: pedidos.prioridad,
      })
      .from(historialPedidos)
      .innerJoin(pedidos, eq(historialPedidos.pedidoId, pedidos.id))
      .leftJoin(clientes, eq(pedidos.clienteId, clientes.id))
      .where(
        or(
          eq(historialPedidos.estadoNuevo, 'ENTREGADO'),
          eq(historialPedidos.estadoNuevo, 'CANCELADO'),
        ),
      )
      .orderBy(desc(historialPedidos.createdAt), desc(historialPedidos.id));
    /* * Un pedido solo puede aparecer una vez. * * Como los registros están ordenados del * más reciente al más antiguo, conservamos * únicamente el primero. */ const pedidosProcesados =
      new Set<number>();
    return historial
      .filter((item) => {
        if (pedidosProcesados.has(item.pedidoId)) {
          return false;
        }
        pedidosProcesados.add(item.pedidoId);
        return true;
      })
      .map((item) => ({
        id: item.id,
        pedidoId: item.pedidoId,
        estadoAnterior: item.estadoAnterior,
        estado: item.estado,
        estadoPago: item.estadoPago,
        fecha: item.fecha,
        cliente: item.clienteId
          ? {
              id: item.clienteId,
              nombre: item.clienteNombre,
              telefono: item.clienteTelefono,
            }
          : null,
        servicio: item.servicio,
        ancho: item.ancho,
        largo: item.largo,
        precioCalculado: item.precioCalculado,
        precioEspecial: item.precioEspecial,
        costoDiseno: item.costoDiseno,
        aporteDesarrollador: item.aporteDesarrollador,
        valorCobrar: item.valorCobrar,
        /* * Se mantiene temporalmente * por compatibilidad. */ precioFinal:
          item.precioEspecial ?? item.precioCalculado,
        prioridad: item.prioridad,
      }));
  }
}
