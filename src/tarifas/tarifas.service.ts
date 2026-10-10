import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ne } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { clientes, tarifas, tarifasClientes } from '../database/schema';

export type ServicioTarifa = 'TEXTIL' | 'UV';

@Injectable()
export class TarifasService {
  constructor(private readonly database: DatabaseService) {}

  async listar() {
    return this.database.db.select().from(tarifas);
  }

  async obtenerPorId(id: number) {
    const resultado = await this.database.db
      .select()
      .from(tarifas)
      .where(eq(tarifas.id, id));

    if (resultado.length === 0) {
      throw new NotFoundException('Tarifa no encontrada');
    }

    return resultado[0];
  }

  async crear(data: {
    servicio: ServicioTarifa;
    ancho: number;
    desde: number;
    hasta?: number | null;
    precio: number;
  }) {
    this.validarDatos(data);

    await this.validarSolapamiento(
      data.servicio,
      data.ancho,
      data.desde,
      data.hasta ?? null,
    );

    const resultado = await this.database.db
      .insert(tarifas)
      .values({
        servicio: data.servicio,
        ancho: data.ancho,
        desde: data.desde,
        hasta: data.hasta ?? null,
        precio: data.precio,
      })
      .returning();

    return resultado[0];
  }

  async actualizar(
    id: number,
    data: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    await this.obtenerPorId(id);

    this.validarDatos(data);

    await this.validarSolapamiento(
      data.servicio,
      data.ancho,
      data.desde,
      data.hasta ?? null,
      id,
    );

    const resultado = await this.database.db
      .update(tarifas)
      .set({
        servicio: data.servicio,
        ancho: data.ancho,
        desde: data.desde,
        hasta: data.hasta ?? null,
        precio: data.precio,
        updatedAt: new Date(),
      })
      .where(eq(tarifas.id, id))
      .returning();

    return resultado[0];
  }

  async cambiarActivo(id: number, activo: boolean) {
    const tarifa = await this.obtenerPorId(id);

    if (activo) {
      await this.validarSolapamiento(
        tarifa.servicio as ServicioTarifa,
        tarifa.ancho,
        tarifa.desde,
        tarifa.hasta,
        id,
      );
    }

    const resultado = await this.database.db
      .update(tarifas)
      .set({
        activo,
        updatedAt: new Date(),
      })
      .where(eq(tarifas.id, id))
      .returning();

    return resultado[0];
  }

  private validarDatos(data: {
    servicio: ServicioTarifa;
    ancho: number;
    desde: number;
    hasta?: number | null;
    precio: number;
  }) {
    if (data.servicio !== 'TEXTIL' && data.servicio !== 'UV') {
      throw new BadRequestException('Servicio no válido');
    }

    const anchosValidos = data.servicio === 'TEXTIL' ? [31, 58] : [29];

    if (!anchosValidos.includes(data.ancho)) {
      throw new BadRequestException(
        `Ancho no válido para el servicio ${data.servicio}`,
      );
    }

    if (!Number.isFinite(data.desde) || data.desde < 0) {
      throw new BadRequestException(
        'El valor desde debe ser mayor o igual a 0 cm',
      );
    }

    if (data.hasta !== null && data.hasta !== undefined) {
      if (!Number.isFinite(data.hasta) || data.hasta <= data.desde) {
        throw new BadRequestException(
          'El valor hasta debe ser mayor que desde',
        );
      }
    }

    if (!Number.isFinite(data.precio) || data.precio <= 0) {
      throw new BadRequestException('El precio debe ser mayor que 0');
    }
  }

  private async validarSolapamiento(
    servicio: ServicioTarifa,
    ancho: number,
    desde: number,
    hasta: number | null,
    excluirId?: number,
  ) {
    const condiciones = [
      eq(tarifas.servicio, servicio),
      eq(tarifas.ancho, ancho),
      eq(tarifas.activo, true),
    ];

    if (excluirId !== undefined) {
      condiciones.push(ne(tarifas.id, excluirId));
    }

    const existentes = await this.database.db
      .select()
      .from(tarifas)
      .where(and(...condiciones));

    const nuevoHasta = hasta ?? Infinity;

    const solapa = existentes.some((tarifa) => {
      const existenteHasta = tarifa.hasta ?? Infinity;

      return desde < existenteHasta && tarifa.desde < nuevoHasta;
    });

    if (solapa) {
      throw new BadRequestException(
        'El rango de la tarifa se solapa con otra tarifa activa',
      );
    }
  }
  async obtenerTarifaAplicable(
    servicio: ServicioTarifa,
    ancho: number,
    largoCm: number,
  ) {
    const tarifasActivas = await this.database.db
      .select()
      .from(tarifas)
      .where(
        and(
          eq(tarifas.servicio, servicio),
          eq(tarifas.ancho, ancho),
          eq(tarifas.activo, true),
        ),
      );

    const tarifa = tarifasActivas.find((tarifa) => {
      const cumpleDesde = largoCm >= tarifa.desde;
      const cumpleHasta = tarifa.hasta === null || largoCm < tarifa.hasta;

      return cumpleDesde && cumpleHasta;
    });

    return tarifa ?? null;
  }

  async listarDeCliente(clienteId: number) {
    await this.obtenerCliente(clienteId);
    return this.database.db
      .select()
      .from(tarifasClientes)
      .where(eq(tarifasClientes.clienteId, clienteId));
  }

  async establecerClienteEspecial(clienteId: number, activo: boolean) {
    await this.obtenerCliente(clienteId);
    const [cliente] = await this.database.db
      .update(clientes)
      .set({ tarifaEspecial: activo })
      .where(eq(clientes.id, clienteId))
      .returning();
    return cliente;
  }

  async crearParaCliente(
    clienteId: number,
    data: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    await this.obtenerCliente(clienteId);
    this.validarDatos(data);
    await this.validarSolapamientoCliente(
      clienteId,
      data.servicio,
      data.ancho,
      data.desde,
      data.hasta ?? null,
    );

    const tarifa = await this.database.db.transaction(async (tx) => {
      const [creada] = await tx
        .insert(tarifasClientes)
        .values({
          clienteId,
          servicio: data.servicio,
          ancho: data.ancho,
          desde: data.desde,
          hasta: data.hasta ?? null,
          precio: data.precio,
        })
        .returning();
      await tx
        .update(clientes)
        .set({ tarifaEspecial: true })
        .where(eq(clientes.id, clienteId));
      return creada;
    });
    return tarifa;
  }

  async actualizarParaCliente(
    clienteId: number,
    tarifaId: number,
    data: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    await this.obtenerTarifaCliente(clienteId, tarifaId);
    this.validarDatos(data);
    await this.validarSolapamientoCliente(
      clienteId,
      data.servicio,
      data.ancho,
      data.desde,
      data.hasta ?? null,
      tarifaId,
    );

    const [tarifa] = await this.database.db
      .update(tarifasClientes)
      .set({
        servicio: data.servicio,
        ancho: data.ancho,
        desde: data.desde,
        hasta: data.hasta ?? null,
        precio: data.precio,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(tarifasClientes.id, tarifaId),
          eq(tarifasClientes.clienteId, clienteId),
        ),
      )
      .returning();
    return tarifa;
  }

  async eliminarParaCliente(clienteId: number, tarifaId: number) {
    await this.obtenerTarifaCliente(clienteId, tarifaId);
    const [tarifa] = await this.database.db
      .delete(tarifasClientes)
      .where(
        and(
          eq(tarifasClientes.id, tarifaId),
          eq(tarifasClientes.clienteId, clienteId),
        ),
      )
      .returning();
    return tarifa;
  }

  async obtenerTarifaClienteAplicable(
    clienteId: number,
    servicio: ServicioTarifa,
    ancho: number,
    largoCm: number,
  ) {
    const cliente = await this.obtenerCliente(clienteId);
    if (!cliente.tarifaEspecial) {
      return { esEspecial: false, tarifa: null };
    }

    const tarifasActivas = await this.database.db
      .select()
      .from(tarifasClientes)
      .where(
        and(
          eq(tarifasClientes.clienteId, clienteId),
          eq(tarifasClientes.servicio, servicio),
          eq(tarifasClientes.ancho, ancho),
          eq(tarifasClientes.activo, true),
        ),
      );
    const tarifa =
      tarifasActivas.find(
        (item) =>
          largoCm >= item.desde && (item.hasta === null || largoCm < item.hasta),
      ) ?? null;
    return { esEspecial: true, tarifa };
  }

  private async obtenerCliente(clienteId: number) {
    const [cliente] = await this.database.db
      .select()
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);
    if (!cliente) {
      throw new NotFoundException('Cliente no encontrado');
    }
    return cliente;
  }

  private async obtenerTarifaCliente(clienteId: number, tarifaId: number) {
    const [tarifa] = await this.database.db
      .select()
      .from(tarifasClientes)
      .where(
        and(
          eq(tarifasClientes.id, tarifaId),
          eq(tarifasClientes.clienteId, clienteId),
        ),
      )
      .limit(1);
    if (!tarifa) {
      throw new NotFoundException('Tarifa exclusiva no encontrada');
    }
    return tarifa;
  }

  private async validarSolapamientoCliente(
    clienteId: number,
    servicio: ServicioTarifa,
    ancho: number,
    desde: number,
    hasta: number | null,
    excluirId?: number,
  ) {
    const condiciones = [
      eq(tarifasClientes.clienteId, clienteId),
      eq(tarifasClientes.servicio, servicio),
      eq(tarifasClientes.ancho, ancho),
      eq(tarifasClientes.activo, true),
    ];
    if (excluirId !== undefined) {
      condiciones.push(ne(tarifasClientes.id, excluirId));
    }
    const existentes = await this.database.db
      .select()
      .from(tarifasClientes)
      .where(and(...condiciones));
    const nuevoHasta = hasta ?? Infinity;
    const solapa = existentes.some((tarifa) => {
      const existenteHasta = tarifa.hasta ?? Infinity;
      return desde < existenteHasta && tarifa.desde < nuevoHasta;
    });
    if (solapa) {
      throw new BadRequestException(
        'El rango de la tarifa exclusiva se solapa con otra tarifa activa del cliente',
      );
    }
  }
}
