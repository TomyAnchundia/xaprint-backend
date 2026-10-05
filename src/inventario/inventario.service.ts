import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  abonosVentasInventario,
  categoriasInventario,
  clientes,
  itemsVentaInventario,
  movimientosInventario,
  pagos,
  pedidos,
  productosInventario,
  tallasInventario,
  usuariosInventario,
  variantesProductoInventario,
  ventasInventario,
} from '../database/schema';
import { CrearAbonoInventarioDto } from './dto/crear-abono-inventario.dto';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { ActualizarUsuarioInventarioDto } from './dto/actualizar-usuario-inventario.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { CrearTallaDto } from './dto/crear-talla.dto';
import { CrearUsuarioInventarioDto } from './dto/crear-usuario-inventario.dto';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { CrearClienteDto } from '../clientes/dto/crear-cliente.dto';
import { ActualizarClienteDto } from '../clientes/dto/actualizar-cliente.dto';
import { RegistrarMovimientoDto } from './dto/registrar-movimiento.dto';

type UsuarioInventarioActual = {
  id: number;
  username: string;
  rol: string;
};

type ProductoInventario = typeof productosInventario.$inferSelect;
type VarianteProductoInventario =
  typeof variantesProductoInventario.$inferSelect;
type InventarioTransaction = Parameters<
  Parameters<DatabaseService['db']['transaction']>[0]
>[0];

@Injectable()
export class InventarioService {
  constructor(private readonly database: DatabaseService) {}

  async obtenerTallas() {
    return this.database.db
      .select()
      .from(tallasInventario)
      .orderBy(tallasInventario.orden, tallasInventario.id);
  }

  async crearTalla(datos: CrearTallaDto) {
    const nombre = datos.nombre.trim();
    if (!nombre)
      throw new BadRequestException('El nombre de la talla es obligatorio');
    const existentes = await this.database.db
      .select({
        nombre: tallasInventario.nombre,
        orden: tallasInventario.orden,
      })
      .from(tallasInventario);
    if (
      existentes.some(
        (talla) =>
          talla.nombre.toLocaleLowerCase('es') ===
          nombre.toLocaleLowerCase('es'),
      )
    ) {
      throw new ConflictException('La talla ya existe');
    }
    const orden =
      existentes.reduce((maximo, talla) => Math.max(maximo, talla.orden), -1) +
      1;
    const [talla] = await this.database.db
      .insert(tallasInventario)
      .values({ nombre, orden })
      .returning();
    return talla;
  }

  async obtenerCategorias() {
    return this.database.db
      .select()
      .from(categoriasInventario)
      .orderBy(categoriasInventario.nombre);
  }

  async crearCategoria(datos: CrearCategoriaDto) {
    const [existente] = await this.database.db
      .select({ id: categoriasInventario.id })
      .from(categoriasInventario)
      .where(eq(categoriasInventario.nombre, datos.nombre.trim()))
      .limit(1);
    if (existente) throw new ConflictException('La categoría ya existe');

    const [categoria] = await this.database.db
      .insert(categoriasInventario)
      .values({ nombre: datos.nombre.trim() })
      .returning();
    return categoria;
  }

  async actualizarCategoria(id: number, datos: ActualizarCategoriaDto) {
    const [existente] = await this.database.db
      .select({ id: categoriasInventario.id })
      .from(categoriasInventario)
      .where(eq(categoriasInventario.id, id))
      .limit(1);
    if (!existente) throw new NotFoundException('Categoría no encontrada');

    const nombre = datos.nombre.trim();
    const [duplicada] = await this.database.db
      .select({ id: categoriasInventario.id })
      .from(categoriasInventario)
      .where(eq(categoriasInventario.nombre, nombre))
      .limit(1);
    if (duplicada && duplicada.id !== id) {
      throw new ConflictException('Ya existe una categoría con ese nombre');
    }

    return this.database.db.transaction(async (tx) => {
      const [categoria] = await tx
        .update(categoriasInventario)
        .set({ nombre })
        .where(eq(categoriasInventario.id, id))
        .returning();
      return categoria;
    });
  }

  async eliminarCategoria(id: number) {
    const [categoria] = await this.database.db
      .select({ id: categoriasInventario.id })
      .from(categoriasInventario)
      .where(eq(categoriasInventario.id, id))
      .limit(1);
    if (!categoria) throw new NotFoundException('Categoría no encontrada');

    const [producto] = await this.database.db
      .select({ id: productosInventario.id })
      .from(productosInventario)
      .where(eq(productosInventario.categoriaId, id))
      .limit(1);
    if (producto) {
      throw new ConflictException(
        'No se puede eliminar la categoría mientras tenga productos asignados',
      );
    }

    await this.database.db
      .delete(categoriasInventario)
      .where(eq(categoriasInventario.id, id));
    return { id, eliminado: true };
  }

  async validarCredenciales(username: string, password: string) {
    const [usuario] = await this.database.db
      .select()
      .from(usuariosInventario)
      .where(eq(usuariosInventario.username, username))
      .limit(1);

    if (!usuario || !(await argon2.verify(usuario.password, password))) {
      return null;
    }

    return {
      id: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
    };
  }

  async crearUsuario(datos: CrearUsuarioInventarioDto) {
    const username = datos.username.trim();
    if (!username) {
      throw new BadRequestException('El nombre de usuario es obligatorio');
    }
    const [existente] = await this.database.db
      .select({ id: usuariosInventario.id })
      .from(usuariosInventario)
      .where(eq(usuariosInventario.username, username))
      .limit(1);
    if (existente) {
      throw new ConflictException('Ya existe un usuario con ese nombre');
    }

    const password = await argon2.hash(datos.password);
    const [usuario] = await this.database.db
      .insert(usuariosInventario)
      .values({
        username,
        password,
        rol: datos.rol,
      })
      .returning({
        id: usuariosInventario.id,
        username: usuariosInventario.username,
        rol: usuariosInventario.rol,
      });

    return usuario;
  }

  async obtenerUsuarios() {
    return this.database.db
      .select({
        id: usuariosInventario.id,
        username: usuariosInventario.username,
        rol: usuariosInventario.rol,
        createdAt: usuariosInventario.createdAt,
      })
      .from(usuariosInventario)
      .orderBy(usuariosInventario.username);
  }

  async actualizarUsuario(id: number, datos: ActualizarUsuarioInventarioDto) {
    const [existente] = await this.database.db
      .select({
        id: usuariosInventario.id,
        rol: usuariosInventario.rol,
      })
      .from(usuariosInventario)
      .where(eq(usuariosInventario.id, id))
      .limit(1);
    if (!existente)
      throw new NotFoundException('Usuario de inventario no encontrado');

    const username = datos.username?.trim();
    if (username !== undefined) {
      if (!username) {
        throw new BadRequestException('El nombre de usuario es obligatorio');
      }
      const [duplicado] = await this.database.db
        .select({ id: usuariosInventario.id })
        .from(usuariosInventario)
        .where(
          and(
            eq(usuariosInventario.username, username),
            ne(usuariosInventario.id, id),
          ),
        )
        .limit(1);
      if (duplicado) {
        throw new ConflictException('Ya existe un usuario con ese nombre');
      }
    }

    if (existente.rol === 'ADMIN' && datos.rol === 'NORMAL') {
      const administradores = await this.database.db
        .select({ id: usuariosInventario.id })
        .from(usuariosInventario)
        .where(eq(usuariosInventario.rol, 'ADMIN'));
      if (administradores.length <= 1) {
        throw new BadRequestException(
          'Debe permanecer al menos un administrador de inventario',
        );
      }
    }

    const cambios: Partial<typeof usuariosInventario.$inferInsert> = {};
    if (username !== undefined) cambios.username = username;
    if (datos.rol !== undefined) cambios.rol = datos.rol;
    if (datos.password !== undefined) {
      cambios.password = await argon2.hash(datos.password);
    }
    if (!Object.keys(cambios).length) {
      throw new BadRequestException(
        'No se proporcionaron cambios para actualizar',
      );
    }

    const [usuario] = await this.database.db
      .update(usuariosInventario)
      .set(cambios)
      .where(eq(usuariosInventario.id, id))
      .returning({
        id: usuariosInventario.id,
        username: usuariosInventario.username,
        rol: usuariosInventario.rol,
      });
    return usuario;
  }

  async eliminarUsuario(id: number, usuarioActualId: number) {
    if (id === usuarioActualId) {
      throw new BadRequestException(
        'No puedes eliminar la cuenta con la que iniciaste sesión',
      );
    }

    const [existente] = await this.database.db
      .select({
        id: usuariosInventario.id,
        rol: usuariosInventario.rol,
      })
      .from(usuariosInventario)
      .where(eq(usuariosInventario.id, id))
      .limit(1);
    if (!existente) {
      throw new NotFoundException('Usuario de inventario no encontrado');
    }

    const [venta] = await this.database.db
      .select({ id: ventasInventario.id })
      .from(ventasInventario)
      .where(eq(ventasInventario.usuarioId, id))
      .limit(1);
    const [movimiento] = await this.database.db
      .select({ id: movimientosInventario.id })
      .from(movimientosInventario)
      .where(eq(movimientosInventario.usuarioId, id))
      .limit(1);
    if (venta || movimiento) {
      throw new ConflictException(
        'No se puede eliminar un usuario con ventas o movimientos registrados',
      );
    }

    if (existente.rol === 'ADMIN') {
      const administradores = await this.database.db
        .select({ id: usuariosInventario.id })
        .from(usuariosInventario)
        .where(eq(usuariosInventario.rol, 'ADMIN'));
      if (administradores.length <= 1) {
        throw new BadRequestException(
          'Debe permanecer al menos un administrador de inventario',
        );
      }
    }

    await this.database.db
      .delete(usuariosInventario)
      .where(eq(usuariosInventario.id, id));
    return { id, eliminado: true };
  }

  async crearPrimerAdministrador(datos: CrearUsuarioInventarioDto) {
    const password = await argon2.hash(datos.password);
    return this.database.db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: usuariosInventario.id })
        .from(usuariosInventario)
        .limit(1);
      if (existente) {
        throw new BadRequestException(
          'El administrador inicial de inventario ya fue creado',
        );
      }
      const [usuario] = await tx
        .insert(usuariosInventario)
        .values({
          username: datos.username,
          password,
          rol: 'ADMIN',
        })
        .returning({
          id: usuariosInventario.id,
          username: usuariosInventario.username,
          rol: usuariosInventario.rol,
        });
      return usuario;
    });
  }

  async obtenerClientes() {
    const lista = await this.database.db
      .select()
      .from(clientes)
      .orderBy(clientes.nombre);
    const creditSales = await this.database.db
      .select({
        id: ventasInventario.id,
        clienteId: ventasInventario.clienteId,
        total: ventasInventario.total,
      })
      .from(ventasInventario)
      .where(eq(ventasInventario.metodoPago, 'Crédito'));
    if (!creditSales.length) {
      return lista.map((cliente) => ({ ...cliente, saldoDeuda: 0 }));
    }
    const payments = await this.database.db
      .select({
        ventaId: abonosVentasInventario.ventaId,
        monto: abonosVentasInventario.monto,
      })
      .from(abonosVentasInventario)
      .where(
        inArray(
          abonosVentasInventario.ventaId,
          creditSales.map((sale) => sale.id),
        ),
      );
    const paidBySale = new Map<number, number>();
    for (const payment of payments) {
      paidBySale.set(
        payment.ventaId,
        (paidBySale.get(payment.ventaId) ?? 0) + payment.monto,
      );
    }
    const balanceByCustomer = new Map<number, number>();
    for (const sale of creditSales) {
      const balance = Math.max(
        0,
        Math.round(
          (sale.total - (paidBySale.get(sale.id) ?? 0)) * 100,
        ) / 100,
      );
      balanceByCustomer.set(
        sale.clienteId,
        (balanceByCustomer.get(sale.clienteId) ?? 0) + balance,
      );
    }
    return lista.map((cliente) => ({
      ...cliente,
      saldoDeuda:
        Math.round((balanceByCustomer.get(cliente.id) ?? 0) * 100) / 100,
    }));
  }

  async obtenerCuentaCliente(clienteId: number) {
    const [cliente] = await this.database.db
      .select()
      .from(clientes)
      .where(eq(clientes.id, clienteId))
      .limit(1);
    if (!cliente) throw new NotFoundException('Cliente no encontrado');

    const ventas = await this.database.db
      .select()
      .from(ventasInventario)
      .where(
        and(
          eq(ventasInventario.clienteId, clienteId),
          eq(ventasInventario.metodoPago, 'Crédito'),
        ),
      )
      .orderBy(asc(ventasInventario.createdAt), asc(ventasInventario.id));
    if (!ventas.length) {
      return { cliente, saldoDeuda: 0, ventas: [], abonos: [] };
    }
    const idsVentas = ventas.map((venta) => venta.id);
    const lineas = await this.database.db
      .select()
      .from(itemsVentaInventario)
      .where(inArray(itemsVentaInventario.ventaId, idsVentas));
    const abonos = await this.database.db
      .select({
        id: abonosVentasInventario.id,
        ventaId: abonosVentasInventario.ventaId,
        monto: abonosVentasInventario.monto,
        metodoPago: abonosVentasInventario.metodoPago,
        fecha: abonosVentasInventario.createdAt,
        usuario: usuariosInventario.username,
      })
      .from(abonosVentasInventario)
      .innerJoin(
        usuariosInventario,
        eq(abonosVentasInventario.usuarioId, usuariosInventario.id),
      )
      .where(inArray(abonosVentasInventario.ventaId, idsVentas))
      .orderBy(
        desc(abonosVentasInventario.createdAt),
        desc(abonosVentasInventario.id),
      );
    const pagadoPorVenta = new Map<number, number>();
    for (const abono of abonos) {
      pagadoPorVenta.set(
        abono.ventaId,
        (pagadoPorVenta.get(abono.ventaId) ?? 0) + abono.monto,
      );
    }
    const ventasConSaldo = ventas.map((venta) => {
      const pagado = Math.round((pagadoPorVenta.get(venta.id) ?? 0) * 100) / 100;
      return {
        id: `V-${venta.id}`,
        fecha: venta.createdAt,
        total: venta.total,
        pagado,
        saldo: Math.max(0, Math.round((venta.total - pagado) * 100) / 100),
        items: lineas
          .filter((linea) => linea.ventaId === venta.id)
          .map((linea) => ({
            nombre: linea.productoNombre,
            talla: linea.tallaNombre,
            presentacion: linea.presentacion,
            cantidad: linea.cantidad,
            precio: linea.precio,
            total: linea.total,
          })),
      };
    });
    return {
      cliente,
      saldoDeuda:
        Math.round(
          ventasConSaldo.reduce((total, venta) => total + venta.saldo, 0) * 100,
        ) / 100,
      ventas: ventasConSaldo,
      abonos: abonos.map((abono) => ({
        ...abono,
        venta: `V-${abono.ventaId}`,
      })),
    };
  }

  async crearAbonoCliente(
    clienteId: number,
    datos: CrearAbonoInventarioDto,
    usuario: UsuarioInventarioActual,
  ) {
    return this.database.db.transaction(async (tx) => {
      const [cliente] = await tx
        .select({ id: clientes.id })
        .from(clientes)
        .where(eq(clientes.id, clienteId))
        .limit(1);
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const ventas = await tx
        .select()
        .from(ventasInventario)
        .where(
          and(
            eq(ventasInventario.clienteId, clienteId),
            eq(ventasInventario.metodoPago, 'Crédito'),
          ),
        )
        .orderBy(asc(ventasInventario.createdAt), asc(ventasInventario.id));
      const abonos = ventas.length
        ? await tx
            .select({
              ventaId: abonosVentasInventario.ventaId,
              monto: abonosVentasInventario.monto,
            })
            .from(abonosVentasInventario)
            .where(
              inArray(
                abonosVentasInventario.ventaId,
                ventas.map((venta) => venta.id),
              ),
            )
        : [];
      const pagadoPorVenta = new Map<number, number>();
      for (const abono of abonos) {
        pagadoPorVenta.set(
          abono.ventaId,
          (pagadoPorVenta.get(abono.ventaId) ?? 0) + abono.monto,
        );
      }
      let saldoDisponible = ventas.reduce(
        (total, venta) =>
          total +
          Math.max(
            0,
            Math.round(
              (venta.total - (pagadoPorVenta.get(venta.id) ?? 0)) * 100,
            ) / 100,
          ),
        0,
      );
      const monto = Math.round(datos.monto * 100) / 100;
      if (monto > saldoDisponible) {
        throw new BadRequestException(
          'El abono no puede superar la deuda pendiente del cliente',
        );
      }

      let restante = monto;
      const registrados: (typeof abonosVentasInventario.$inferSelect)[] = [];
      for (const venta of ventas) {
        if (restante <= 0) break;
        const saldoVenta = Math.max(
          0,
          Math.round(
            (venta.total - (pagadoPorVenta.get(venta.id) ?? 0)) * 100,
          ) / 100,
        );
        const aplicado = Math.min(saldoVenta, restante);
        if (aplicado <= 0) continue;
        const [abono] = await tx
          .insert(abonosVentasInventario)
          .values({
            ventaId: venta.id,
            clienteId,
            usuarioId: usuario.id,
            monto: aplicado,
            metodoPago: datos.metodoPago,
          })
          .returning();
        registrados.push(abono);
        restante = Math.round((restante - aplicado) * 100) / 100;
      }
      saldoDisponible = Math.round((saldoDisponible - monto) * 100) / 100;
      return {
        clienteId,
        monto,
        metodoPago: datos.metodoPago,
        saldoDeuda: saldoDisponible,
        abonos: registrados,
      };
    });
  }

  async crearCliente(datos: CrearClienteDto) {
    const nombre = datos.nombre.trim();
    const telefono = datos.telefono.trim();
    if (!nombre || !telefono) {
      throw new BadRequestException('El nombre y teléfono son obligatorios');
    }
    const [existente] = await this.database.db
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.telefono, telefono))
      .limit(1);
    if (existente) {
      throw new ConflictException('Ya existe un cliente con ese teléfono');
    }

    const [cliente] = await this.database.db
      .insert(clientes)
      .values({
        nombre,
        telefono,
        cedula: datos.cedula?.trim() || null,
        direccion: datos.direccion?.trim() || null,
      })
      .returning();
    return cliente;
  }

  async actualizarCliente(id: number, datos: ActualizarClienteDto) {
    const [existente] = await this.database.db
      .select({ id: clientes.id })
      .from(clientes)
      .where(eq(clientes.id, id))
      .limit(1);
    if (!existente) throw new NotFoundException('Cliente no encontrado');

    const cambios: Partial<typeof clientes.$inferInsert> = {};
    if (datos.nombre !== undefined) {
      const nombre = datos.nombre.trim();
      if (!nombre) {
        throw new BadRequestException('El nombre es obligatorio');
      }
      cambios.nombre = nombre;
    }
    if (datos.telefono !== undefined) {
      const telefono = datos.telefono.trim();
      if (!telefono) {
        throw new BadRequestException('El teléfono es obligatorio');
      }
      const [duplicado] = await this.database.db
        .select({ id: clientes.id })
        .from(clientes)
        .where(and(eq(clientes.telefono, telefono), ne(clientes.id, id)))
        .limit(1);
      if (duplicado) {
        throw new ConflictException('Ya existe un cliente con ese teléfono');
      }
      cambios.telefono = telefono;
    }
    if (datos.cedula !== undefined) {
      cambios.cedula = datos.cedula?.trim() || null;
    }
    if (datos.direccion !== undefined) {
      cambios.direccion = datos.direccion?.trim() || null;
    }
    if (!Object.keys(cambios).length) {
      throw new BadRequestException(
        'No se proporcionaron cambios para actualizar',
      );
    }

    const [cliente] = await this.database.db
      .update(clientes)
      .set(cambios)
      .where(eq(clientes.id, id))
      .returning();
    return cliente;
  }

  async eliminarCliente(id: number) {
    await this.database.db.transaction(async (tx) => {
      const [existente] = await tx
        .select({ id: clientes.id })
        .from(clientes)
        .where(eq(clientes.id, id))
        .limit(1);
      if (!existente) throw new NotFoundException('Cliente no encontrado');

      const [pedido] = await tx
        .select({ id: pedidos.id })
        .from(pedidos)
        .where(eq(pedidos.clienteId, id))
        .limit(1);
      const [pago] = await tx
        .select({ id: pagos.id })
        .from(pagos)
        .where(eq(pagos.clienteId, id))
        .limit(1);
      const [venta] = await tx
        .select({ id: ventasInventario.id })
        .from(ventasInventario)
        .where(eq(ventasInventario.clienteId, id))
        .limit(1);
      if (pedido || pago || venta) {
        throw new ConflictException(
          'No se puede eliminar un cliente con pedidos, pagos o ventas registrados',
        );
      }

      await tx.delete(clientes).where(eq(clientes.id, id));
    });
    return { id, eliminado: true };
  }
  async obtenerProductos() {
    return this.obtenerProductosConVariantes();
  }

  async obtenerProductosParaVenta() {
    return this.obtenerProductosConVariantes();
  }

  async crearProducto(
    datos: CrearProductoDto,
    usuario: UsuarioInventarioActual,
  ) {
    const categoria = await this.obtenerCategoria(datos.categoriaId);
    this.validarConfiguracionCaja(
      datos.unidadesPorCaja,
      datos.precioCaja,
    );
    const producto = await this.database.db.transaction(async (tx) => {
      const tallas =
        datos.variantes !== undefined
          ? datos.variantes
          : [
              {
                tallaId: await this.obtenerTallaUnicaId(tx),
                existencia: datos.existencia ?? 0,
                stockMinimo: datos.stockMinimo ?? 0,
              },
            ];
      if (!tallas.length) {
        throw new BadRequestException('Selecciona al menos una talla');
      }
      const tallaIds = tallas.map((variante) => variante.tallaId);
      if (new Set(tallaIds).size !== tallaIds.length) {
        throw new BadRequestException(
          'No puedes repetir una talla en el producto',
        );
      }
      const idsTallasExistentes = await tx
        .select({ id: tallasInventario.id })
        .from(tallasInventario)
        .where(inArray(tallasInventario.id, tallaIds));
      if (idsTallasExistentes.length !== tallaIds.length) {
        throw new NotFoundException(
          'Una de las tallas seleccionadas no existe',
        );
      }
      const [row] = await tx
        .insert(productosInventario)
        .values({
          nombre: datos.nombre,
          sku: 'SKU-PENDING',
          codigoBarras: 'SKU-PENDING',
          categoriaId: categoria.id,
          precio: datos.precio,
          unidadesPorCaja: datos.unidadesPorCaja ?? null,
          precioCaja: datos.precioCaja ?? null,
          existencia: tallas.reduce(
            (total, talla) => total + talla.existencia,
            0,
          ),
          stockMinimo: tallas.reduce(
            (total, talla) => total + (talla.stockMinimo ?? 0),
            0,
          ),
        })
        .returning();
      const sku = `XAP-${String(row.id).padStart(6, '0')}`;
      const [productoCreado] = await tx
        .update(productosInventario)
        .set({
          sku,
          codigoBarras: `BC-${sku}`,
        })
        .where(eq(productosInventario.id, row.id))
        .returning();
      for (const talla of tallas) {
        const [variante] = await tx
          .insert(variantesProductoInventario)
          .values({
            productoId: productoCreado.id,
            tallaId: talla.tallaId,
            sku: `${sku}-T${talla.tallaId}`,
            codigoBarras: `BC-${sku}-T${talla.tallaId}`,
            existencia: talla.existencia,
            stockMinimo: talla.stockMinimo ?? 0,
          })
          .returning();
        const [tallaDetalle] = await tx
          .select({ nombre: tallasInventario.nombre })
          .from(tallasInventario)
          .where(eq(tallasInventario.id, talla.tallaId))
          .limit(1);
        if (variante.existencia > 0) {
          await tx.insert(movimientosInventario).values({
            productoId: productoCreado.id,
            varianteId: variante.id,
            tallaNombre: tallaDetalle.nombre,
            productoNombre: productoCreado.nombre,
            usuarioId: usuario.id,
            tipo: 'Ingreso',
            cantidad: variante.existencia,
          });
        }
      }
      return { ...productoCreado, sku };
    });
    return this.formatearProductoConVariantes(producto, categoria.nombre);
  }

  async actualizarProducto(
    id: number,
    datos: ActualizarProductoDto,
    usuario: UsuarioInventarioActual,
  ) {
    const categoria =
      datos.categoriaId === undefined
        ? null
        : await this.obtenerCategoria(datos.categoriaId);
    const resultado = await this.database.db.transaction(async (tx) => {
      const [producto] = await tx
        .select()
        .from(productosInventario)
        .where(
          and(
            eq(productosInventario.id, id),
            eq(productosInventario.activo, true),
          ),
        )
        .limit(1);
      if (!producto) throw new NotFoundException('Producto no encontrado');

      const cambios: Partial<typeof productosInventario.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (datos.nombre !== undefined) cambios.nombre = datos.nombre;
      if (categoria) {
        cambios.categoriaId = categoria.id;
      }
      if (datos.precio !== undefined) cambios.precio = datos.precio;
      if (
        datos.unidadesPorCaja !== undefined ||
        datos.precioCaja !== undefined
      ) {
        const unidadesPorCaja =
          datos.unidadesPorCaja === undefined
            ? producto.unidadesPorCaja
            : datos.unidadesPorCaja;
        const precioCaja =
          datos.precioCaja === undefined ? producto.precioCaja : datos.precioCaja;
        this.validarConfiguracionCaja(unidadesPorCaja, precioCaja);
        cambios.unidadesPorCaja = unidadesPorCaja;
        cambios.precioCaja = precioCaja;
      }
      const variantesActuales = await tx
        .select({
          variante: variantesProductoInventario,
          tallaNombre: tallasInventario.nombre,
        })
        .from(variantesProductoInventario)
        .innerJoin(
          tallasInventario,
          eq(variantesProductoInventario.tallaId, tallasInventario.id),
        )
        .where(eq(variantesProductoInventario.productoId, id));
      if (datos.variantes) {
        if (!datos.variantes.length) {
          throw new BadRequestException(
            'El producto debe tener al menos una talla',
          );
        }
        const tallaIds = datos.variantes.map((variante) => variante.tallaId);
        if (new Set(tallaIds).size !== tallaIds.length) {
          throw new BadRequestException(
            'No puedes repetir una talla en el producto',
          );
        }
        const tallasExistentes = await tx
          .select({ id: tallasInventario.id })
          .from(tallasInventario)
          .where(inArray(tallasInventario.id, tallaIds));
        if (tallasExistentes.length !== tallaIds.length) {
          throw new NotFoundException(
            'Una de las tallas seleccionadas no existe',
          );
        }

        for (const talla of datos.variantes) {
          const existente = variantesActuales.find(
            (variante) => variante.variante.tallaId === talla.tallaId,
          );
          if (existente) {
            const diferencia = talla.existencia - existente.variante.existencia;
            await tx
              .update(variantesProductoInventario)
              .set({
                existencia: talla.existencia,
                stockMinimo: talla.stockMinimo ?? 0,
              })
              .where(eq(variantesProductoInventario.id, existente.variante.id));
            if (diferencia !== 0) {
              await tx.insert(movimientosInventario).values({
                productoId: id,
                varianteId: existente.variante.id,
                tallaNombre: existente.tallaNombre,
                productoNombre: producto.nombre,
                usuarioId: usuario.id,
                tipo: diferencia > 0 ? 'Ingreso' : 'Salida',
                cantidad: Math.abs(diferencia),
              });
            }
          } else {
            const sku = `${producto.sku}-T${talla.tallaId}`;
            const [tallaDetalle] = await tx
              .select({ nombre: tallasInventario.nombre })
              .from(tallasInventario)
              .where(eq(tallasInventario.id, talla.tallaId))
              .limit(1);
            const [variante] = await tx
              .insert(variantesProductoInventario)
              .values({
                productoId: id,
                tallaId: talla.tallaId,
                sku,
                codigoBarras: `BC-${sku}`,
                existencia: talla.existencia,
                stockMinimo: talla.stockMinimo ?? 0,
              })
              .returning();
            if (variante.existencia > 0) {
              await tx.insert(movimientosInventario).values({
                productoId: id,
                varianteId: variante.id,
                tallaNombre: tallaDetalle.nombre,
                productoNombre: producto.nombre,
                usuarioId: usuario.id,
                tipo: 'Ingreso',
                cantidad: variante.existencia,
              });
            }
          }
        }

        for (const variante of variantesActuales) {
          if (tallaIds.includes(variante.variante.tallaId)) continue;
          const [venta] = await tx
            .select({ id: itemsVentaInventario.id })
            .from(itemsVentaInventario)
            .where(eq(itemsVentaInventario.varianteId, variante.variante.id))
            .limit(1);
          const [movimiento] = await tx
            .select({ id: movimientosInventario.id })
            .from(movimientosInventario)
            .where(eq(movimientosInventario.varianteId, variante.variante.id))
            .limit(1);
          if (venta || movimiento || variante.variante.existencia > 0) {
            throw new ConflictException(
              `No se puede quitar la talla ${variante.tallaNombre}: tiene stock o historial`,
            );
          }
          await tx
            .delete(variantesProductoInventario)
            .where(eq(variantesProductoInventario.id, variante.variante.id));
        }
      } else if (
        datos.existencia !== undefined ||
        datos.stockMinimo !== undefined
      ) {
        if (variantesActuales.length !== 1) {
          throw new BadRequestException(
            'Actualiza las existencias por talla para este producto',
          );
        }
        const variante = variantesActuales[0];
        const existencia = datos.existencia ?? variante.variante.existencia;
        const diferencia = existencia - variante.variante.existencia;
        await tx
          .update(variantesProductoInventario)
          .set({
            existencia,
            stockMinimo: datos.stockMinimo ?? variante.variante.stockMinimo,
          })
          .where(eq(variantesProductoInventario.id, variante.variante.id));
        if (diferencia !== 0) {
          await tx.insert(movimientosInventario).values({
            productoId: id,
            varianteId: variante.variante.id,
            tallaNombre: variante.tallaNombre,
            productoNombre: producto.nombre,
            usuarioId: usuario.id,
            tipo: diferencia > 0 ? 'Ingreso' : 'Salida',
            cantidad: Math.abs(diferencia),
          });
        }
      }

      const totales = await tx
        .select({
          existencia: variantesProductoInventario.existencia,
          stockMinimo: variantesProductoInventario.stockMinimo,
        })
        .from(variantesProductoInventario)
        .where(eq(variantesProductoInventario.productoId, id));
      cambios.existencia = totales.reduce(
        (total, variante) => total + variante.existencia,
        0,
      );
      cambios.stockMinimo = totales.reduce(
        (total, variante) => total + variante.stockMinimo,
        0,
      );
      const [row] = await tx
        .update(productosInventario)
        .set(cambios)
        .where(eq(productosInventario.id, id))
        .returning();
      return row;
    });
    const categoriaNombre =
      categoria?.nombre ??
      (await this.obtenerCategoria(resultado.categoriaId ?? 0)).nombre;
    return this.formatearProductoConVariantes(resultado, categoriaNombre);
  }

  async eliminarProducto(id: number) {
    const [producto] = await this.database.db
      .update(productosInventario)
      .set({ activo: false, updatedAt: new Date() })
      .where(
        and(
          eq(productosInventario.id, id),
          eq(productosInventario.activo, true),
        ),
      )
      .returning({ id: productosInventario.id });
    if (!producto) throw new NotFoundException('Producto no encontrado');
    return { id: producto.id, eliminado: true };
  }

  async obtenerMovimientos(limite?: number) {
    const query = this.database.db
      .select({
        id: movimientosInventario.id,
        productId: movimientosInventario.productoId,
        productName: movimientosInventario.productoNombre,
        variantId: movimientosInventario.varianteId,
        size: movimientosInventario.tallaNombre,
        type: movimientosInventario.tipo,
        quantity: movimientosInventario.cantidad,
        date: movimientosInventario.createdAt,
        user: usuariosInventario.username,
      })
      .from(movimientosInventario)
      .innerJoin(
        usuariosInventario,
        eq(movimientosInventario.usuarioId, usuariosInventario.id),
      )
      .orderBy(desc(movimientosInventario.createdAt));
    return limite ? query.limit(limite) : query;
  }

  async registrarMovimiento(
    datos: RegistrarMovimientoDto,
    usuario: UsuarioInventarioActual,
  ) {
    return this.database.db.transaction(async (tx) => {
      let varianteId = datos.varianteId;
      if (!varianteId && datos.productoId) {
        const variantes = await tx
          .select({ id: variantesProductoInventario.id })
          .from(variantesProductoInventario)
          .where(eq(variantesProductoInventario.productoId, datos.productoId));
        if (variantes.length !== 1) {
          throw new BadRequestException(
            'Selecciona una talla para registrar el movimiento',
          );
        }
        varianteId = variantes[0].id;
      }
      if (!varianteId) {
        throw new BadRequestException(
          'Debes seleccionar una talla del producto',
        );
      }
      const [detalle] = await tx
        .select({
          variante: variantesProductoInventario,
          producto: productosInventario,
          tallaNombre: tallasInventario.nombre,
        })
        .from(variantesProductoInventario)
        .innerJoin(
          productosInventario,
          eq(variantesProductoInventario.productoId, productosInventario.id),
        )
        .innerJoin(
          tallasInventario,
          eq(variantesProductoInventario.tallaId, tallasInventario.id),
        )
        .where(
          and(
            eq(variantesProductoInventario.id, varianteId),
            eq(productosInventario.activo, true),
          ),
        )
        .limit(1);
      if (!detalle) throw new NotFoundException('Variante no encontrada');

      const nuevoStock =
        datos.tipo === 'Ingreso'
          ? detalle.variante.existencia + datos.cantidad
          : detalle.variante.existencia - datos.cantidad;
      if (nuevoStock < 0) {
        throw new BadRequestException('No hay existencias suficientes');
      }
      if (!Number.isSafeInteger(nuevoStock)) {
        throw new BadRequestException('La cantidad supera el límite permitido');
      }

      await tx
        .update(variantesProductoInventario)
        .set({ existencia: nuevoStock })
        .where(eq(variantesProductoInventario.id, detalle.variante.id));
      await this.actualizarStockAgregado(tx, detalle.producto.id);
      const [movimiento] = await tx
        .insert(movimientosInventario)
        .values({
          productoId: detalle.producto.id,
          varianteId: detalle.variante.id,
          tallaNombre: detalle.tallaNombre,
          productoNombre: detalle.producto.nombre,
          usuarioId: usuario.id,
          tipo: datos.tipo,
          cantidad: datos.cantidad,
        })
        .returning();
      return {
        id: movimiento.id,
        productId: movimiento.productoId,
        productName: movimiento.productoNombre,
        variantId: movimiento.varianteId,
        size: movimiento.tallaNombre,
        type: movimiento.tipo,
        quantity: movimiento.cantidad,
        date: movimiento.createdAt,
        user: usuario.username,
      };
    });
  }

  async crearVenta(datos: CrearVentaDto, usuario: UsuarioInventarioActual) {
    return this.database.db.transaction(async (tx) => {
      const [cliente] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, datos.clienteId))
        .limit(1);
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const lineasPorClave = new Map<
        string,
        {
          producto: ProductoInventario;
          variante: VarianteProductoInventario;
          tallaNombre: string;
          presentacion: 'UNIDAD' | 'CAJA';
          unidadesPorPresentacion: number;
          cantidad: number;
          precio: number;
        }
      >();
      for (const item of datos.items) {
        const varianteId = await this.resolverVarianteVenta(tx, item);
        const [detalle] = await tx
          .select({
            producto: productosInventario,
            variante: variantesProductoInventario,
            tallaNombre: tallasInventario.nombre,
          })
          .from(variantesProductoInventario)
          .innerJoin(
            productosInventario,
            eq(variantesProductoInventario.productoId, productosInventario.id),
          )
          .innerJoin(
            tallasInventario,
            eq(variantesProductoInventario.tallaId, tallasInventario.id),
          )
          .where(
            and(
              eq(variantesProductoInventario.id, varianteId),
              eq(productosInventario.activo, true),
            ),
          )
          .limit(1);
        if (!detalle) {
          throw new NotFoundException(`Variante ${varianteId} no encontrada`);
        }
        const presentacion = item.presentacion ?? 'UNIDAD';
        const unidadesPorPresentacion =
          presentacion === 'CAJA' ? detalle.producto.unidadesPorCaja : 1;
        const precio =
          presentacion === 'CAJA'
            ? detalle.producto.precioCaja
            : detalle.producto.precio;
        if (
          presentacion === 'CAJA' &&
          (unidadesPorPresentacion === null || precio === null)
        ) {
          throw new BadRequestException(
            `${detalle.producto.nombre} no tiene una caja configurada`,
          );
        }
        const clave = `${varianteId}:${presentacion}`;
        const anterior = lineasPorClave.get(clave);
        lineasPorClave.set(clave, {
          ...detalle,
          presentacion,
          unidadesPorPresentacion: unidadesPorPresentacion ?? 1,
          cantidad: (anterior?.cantidad ?? 0) + item.cantidad,
          precio: precio ?? detalle.producto.precio,
        });
      }

      const unidadesPorVariante = new Map<number, number>();
      const items = [...lineasPorClave.values()].map((item) => {
        const consumo = item.cantidad * item.unidadesPorPresentacion;
        unidadesPorVariante.set(
          item.variante.id,
          (unidadesPorVariante.get(item.variante.id) ?? 0) + consumo,
        );
        return {
          ...item,
          consumo,
          total: Math.round(item.precio * item.cantidad * 100) / 100,
        };
      });
      for (const item of items) {
        if (
          item.variante.existencia <
          (unidadesPorVariante.get(item.variante.id) ?? 0)
        ) {
          throw new BadRequestException(
            `Existencias insuficientes para ${item.producto.nombre} talla ${item.tallaNombre}`,
          );
        }
      }
      const total =
        Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) /
        100;
      const abonoInicial = Math.round((datos.abonoInicial ?? 0) * 100) / 100;
      if (datos.metodoPago === 'Crédito') {
        if (abonoInicial > total) {
          throw new BadRequestException(
            'El abono inicial no puede superar el total de la venta',
          );
        }
        if (abonoInicial > 0 && !datos.metodoAbonoInicial) {
          throw new BadRequestException(
            'Selecciona el método de pago del abono inicial',
          );
        }
      } else if (abonoInicial > 0) {
        throw new BadRequestException(
          'El abono inicial solo aplica a ventas a crédito',
        );
      }
      const [venta] = await tx
        .insert(ventasInventario)
        .values({
          clienteId: cliente.id,
          usuarioId: usuario.id,
          metodoPago: datos.metodoPago,
          total,
        })
        .returning();

      await tx.insert(itemsVentaInventario).values(
        items.map(
          ({
            producto,
            variante,
            tallaNombre,
            presentacion,
            unidadesPorPresentacion,
            cantidad,
            precio,
            total: itemTotal,
          }) => ({
            ventaId: venta.id,
            productoId: producto.id,
            varianteId: variante.id,
            tallaNombre,
            presentacion,
            unidadesPorPresentacion,
            productoNombre: producto.nombre,
            cantidad,
            precio,
            total: itemTotal,
          }),
        ),
      );

      const ventasPorVariante = new Map(
        items.map((item) => [item.variante.id, item]),
      );
      for (const [varianteId, consumo] of unidadesPorVariante) {
        const { producto, variante, tallaNombre } =
          ventasPorVariante.get(varianteId)!;
        await tx
          .update(variantesProductoInventario)
          .set({ existencia: variante.existencia - consumo })
          .where(eq(variantesProductoInventario.id, variante.id));
        await tx.insert(movimientosInventario).values({
          productoId: producto.id,
          varianteId: variante.id,
          tallaNombre,
          productoNombre: producto.nombre,
          usuarioId: usuario.id,
          tipo: 'Venta',
          cantidad: consumo,
        });
        await this.actualizarStockAgregado(tx, producto.id);
      }

      if (abonoInicial > 0) {
        await tx.insert(abonosVentasInventario).values({
          ventaId: venta.id,
          clienteId: cliente.id,
          usuarioId: usuario.id,
          monto: abonoInicial,
          metodoPago: datos.metodoAbonoInicial!,
        });
      }

      return {
        id: `V-${venta.id}`,
        date: venta.createdAt,
        customerId: cliente.id,
        customerName: cliente.nombre,
        customerPhone: cliente.telefono,
        items: items.map(
          ({
            producto,
            variante,
            tallaNombre,
            presentacion,
            unidadesPorPresentacion,
            cantidad,
            precio,
          }) => ({
          productId: producto.id,
          variantId: variante.id,
          size: tallaNombre,
          name: producto.nombre,
          presentation: presentacion,
          unitsPerPresentation: unidadesPorPresentacion,
          quantity: cantidad,
          price: precio,
          }),
        ),
        payment: venta.metodoPago,
        total,
        paid: abonoInicial,
        paymentMethodInitial: datos.metodoAbonoInicial ?? 'Efectivo',
        debt: datos.metodoPago === 'Crédito' ? total - abonoInicial : 0,
      };
    });
  }

  async actualizarVenta(
    id: number,
    datos: CrearVentaDto,
    usuario: UsuarioInventarioActual,
  ) {
    return this.database.db.transaction(async (tx) => {
      const [venta] = await tx
        .select()
        .from(ventasInventario)
        .where(eq(ventasInventario.id, id))
        .limit(1);
      if (!venta) throw new NotFoundException('Venta no encontrada');
      if (
        venta.metodoPago === 'Crédito' ||
        datos.metodoPago === 'Crédito'
      ) {
        throw new BadRequestException(
          'Las ventas a crédito no se pueden editar',
        );
      }

      const [cliente] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, datos.clienteId))
        .limit(1);
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const lineasAnteriores = await tx
        .select()
        .from(itemsVentaInventario)
        .where(eq(itemsVentaInventario.ventaId, id));
      const cantidadesAnteriores = new Map<number, number>();
      for (const linea of lineasAnteriores) {
        const varianteId =
          linea.varianteId ??
          (await this.resolverVarianteVenta(tx, {
            productoId: linea.productoId,
          }));
        cantidadesAnteriores.set(
          varianteId,
          (cantidadesAnteriores.get(varianteId) ?? 0) +
            linea.cantidad * linea.unidadesPorPresentacion,
        );
      }

      const cantidades = new Map<number, number>();
      const lineasPorClave = new Map<
        string,
        {
          producto: ProductoInventario;
          variante: VarianteProductoInventario;
          tallaNombre: string;
          presentacion: 'UNIDAD' | 'CAJA';
          unidadesPorPresentacion: number;
          cantidad: number;
          precio: number;
        }
      >();
      for (const item of datos.items) {
        const varianteId = await this.resolverVarianteVenta(tx, item);
        const [detalle] = await tx
          .select({
            producto: productosInventario,
            variante: variantesProductoInventario,
            tallaNombre: tallasInventario.nombre,
          })
          .from(variantesProductoInventario)
          .innerJoin(
            productosInventario,
            eq(variantesProductoInventario.productoId, productosInventario.id),
          )
          .innerJoin(
            tallasInventario,
            eq(variantesProductoInventario.tallaId, tallasInventario.id),
          )
          .where(
            and(
              eq(variantesProductoInventario.id, varianteId),
              eq(productosInventario.activo, true),
            ),
          )
          .limit(1);
        if (!detalle) {
          throw new NotFoundException(`Variante ${varianteId} no encontrada`);
        }
        const presentacion = item.presentacion ?? 'UNIDAD';
        const unidadesPorPresentacion =
          presentacion === 'CAJA' ? detalle.producto.unidadesPorCaja : 1;
        const precio =
          presentacion === 'CAJA'
            ? detalle.producto.precioCaja
            : detalle.producto.precio;
        if (
          presentacion === 'CAJA' &&
          (unidadesPorPresentacion === null || precio === null)
        ) {
          throw new BadRequestException(
            `${detalle.producto.nombre} no tiene una caja configurada`,
          );
        }
        const clave = `${varianteId}:${presentacion}`;
        const anterior = lineasPorClave.get(clave);
        lineasPorClave.set(clave, {
          ...detalle,
          presentacion,
          unidadesPorPresentacion: unidadesPorPresentacion ?? 1,
          cantidad: (anterior?.cantidad ?? 0) + item.cantidad,
          precio: precio ?? detalle.producto.precio,
        });
        cantidades.set(
          varianteId,
          (cantidades.get(varianteId) ?? 0) +
            item.cantidad * (unidadesPorPresentacion ?? 1),
        );
      }

      const items = [...lineasPorClave.values()].map((item) => ({
        ...item,
        total: Math.round(item.precio * item.cantidad * 100) / 100,
      }));
      const idsVariantes = new Set([
        ...cantidadesAnteriores.keys(),
        ...cantidades.keys(),
      ]);
      const existenciasNuevas = new Map<number, number>();
      const detalles = new Map<
        number,
        {
          producto: ProductoInventario;
          variante: VarianteProductoInventario;
          tallaNombre: string;
        }
      >();
      for (const varianteId of idsVariantes) {
        const [detalle] = await tx
          .select({
            producto: productosInventario,
            variante: variantesProductoInventario,
            tallaNombre: tallasInventario.nombre,
          })
          .from(variantesProductoInventario)
          .innerJoin(
            productosInventario,
            eq(variantesProductoInventario.productoId, productosInventario.id),
          )
          .innerJoin(
            tallasInventario,
            eq(variantesProductoInventario.tallaId, tallasInventario.id),
          )
          .where(eq(variantesProductoInventario.id, varianteId))
          .limit(1);
        if (!detalle) {
          throw new NotFoundException(`Variante ${varianteId} no encontrada`);
        }
        detalles.set(varianteId, detalle);
        const cantidadAnterior = cantidadesAnteriores.get(varianteId) ?? 0;
        const cantidadNueva = cantidades.get(varianteId) ?? 0;
        if (!detalle.producto.activo && cantidadNueva > cantidadAnterior) {
          throw new BadRequestException(
            `El producto ${detalle.producto.nombre} ya no está disponible`,
          );
        }
        const existenciaDisponible =
          detalle.variante.existencia + cantidadAnterior;
        if (existenciaDisponible < cantidadNueva) {
          throw new BadRequestException(
            `Existencias insuficientes para ${detalle.producto.nombre} talla ${detalle.tallaNombre}`,
          );
        }
        existenciasNuevas.set(varianteId, existenciaDisponible - cantidadNueva);
      }

      const total =
        Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) /
        100;
      await tx
        .update(ventasInventario)
        .set({ clienteId: cliente.id, metodoPago: datos.metodoPago, total })
        .where(eq(ventasInventario.id, id));
      await tx
        .delete(itemsVentaInventario)
        .where(eq(itemsVentaInventario.ventaId, id));
      await tx.insert(itemsVentaInventario).values(
        items.map(
          ({
            producto,
            variante,
            tallaNombre,
            presentacion,
            unidadesPorPresentacion,
            cantidad,
            precio,
            total: itemTotal,
          }) => ({
            ventaId: id,
            productoId: producto.id,
            varianteId: variante.id,
            tallaNombre,
            presentacion,
            unidadesPorPresentacion,
            productoNombre: producto.nombre,
            cantidad,
            precio,
            total: itemTotal,
          }),
        ),
      );

      for (const varianteId of idsVariantes) {
        const detalle = detalles.get(varianteId)!;
        const cantidadAnterior = cantidadesAnteriores.get(varianteId) ?? 0;
        const cantidadNueva = cantidades.get(varianteId) ?? 0;
        const diferencia = cantidadNueva - cantidadAnterior;
        await tx
          .update(variantesProductoInventario)
          .set({ existencia: existenciasNuevas.get(varianteId)! })
          .where(eq(variantesProductoInventario.id, varianteId));
        if (diferencia !== 0) {
          await tx.insert(movimientosInventario).values({
            productoId: detalle.producto.id,
            varianteId,
            tallaNombre: detalle.tallaNombre,
            productoNombre: detalle.producto.nombre,
            usuarioId: usuario.id,
            tipo: diferencia > 0 ? 'Venta' : 'Ingreso',
            cantidad: Math.abs(diferencia),
          });
        }
        await this.actualizarStockAgregado(tx, detalle.producto.id);
      }

      return {
        id: `V-${venta.id}`,
        date: venta.createdAt,
        customerId: cliente.id,
        customerName: cliente.nombre,
        customerPhone: cliente.telefono,
        items: items.map(
          ({
            producto,
            variante,
            tallaNombre,
            presentacion,
            unidadesPorPresentacion,
            cantidad,
            precio,
          }) => ({
          productId: producto.id,
          variantId: variante.id,
          size: tallaNombre,
          name: producto.nombre,
          presentation: presentacion,
          unitsPerPresentation: unidadesPorPresentacion,
          quantity: cantidad,
          price: precio,
          }),
        ),
        payment: datos.metodoPago,
        total,
      };
    });
  }

  async obtenerVentas() {
    const ventas = await this.database.db
      .select({
        id: ventasInventario.id,
        date: ventasInventario.createdAt,
        customerId: clientes.id,
        customerName: clientes.nombre,
        customerPhone: clientes.telefono,
        payment: ventasInventario.metodoPago,
        total: ventasInventario.total,
      })
      .from(ventasInventario)
      .innerJoin(clientes, eq(ventasInventario.clienteId, clientes.id))
      .orderBy(desc(ventasInventario.createdAt), desc(ventasInventario.id));
    if (!ventas.length) return [];

    const lineas = await this.database.db
      .select()
      .from(itemsVentaInventario)
      .where(
        inArray(
          itemsVentaInventario.ventaId,
          ventas.map((venta) => venta.id),
        ),
      );
    const abonos = await this.database.db
      .select({
        ventaId: abonosVentasInventario.ventaId,
        monto: abonosVentasInventario.monto,
        metodoPago: abonosVentasInventario.metodoPago,
      })
      .from(abonosVentasInventario)
      .where(
        inArray(
          abonosVentasInventario.ventaId,
          ventas.map((venta) => venta.id),
        ),
      )
      .orderBy(asc(abonosVentasInventario.id));
    const pagadoPorVenta = new Map<number, number>();
    for (const abono of abonos) {
      pagadoPorVenta.set(
        abono.ventaId,
        (pagadoPorVenta.get(abono.ventaId) ?? 0) + abono.monto,
      );
    }
    const metodoPorVenta = new Map<number, string>();
    for (const abono of abonos) {
      if (!metodoPorVenta.has(abono.ventaId)) {
        metodoPorVenta.set(abono.ventaId, abono.metodoPago);
      }
    }
    return ventas.map((venta) => ({
      ...venta,
      id: `V-${venta.id}`,
      paid: Math.round((pagadoPorVenta.get(venta.id) ?? 0) * 100) / 100,
      paymentMethodInitial: metodoPorVenta.get(venta.id) ?? 'Efectivo',
      debt:
        venta.payment === 'Crédito'
          ? Math.max(
              0,
              Math.round(
                (venta.total - (pagadoPorVenta.get(venta.id) ?? 0)) * 100,
              ) / 100,
            )
          : 0,
      items: lineas
        .filter((item) => item.ventaId === venta.id)
        .map((item) => ({
          productId: item.productoId,
          variantId: item.varianteId,
          size: item.tallaNombre,
          name: item.productoNombre,
          presentation: item.presentacion,
          unitsPerPresentation: item.unidadesPorPresentacion,
          quantity: item.cantidad,
          price: item.precio,
        })),
    }));
  }

  async obtenerResumen(esAdmin: boolean) {
    const sales = await this.obtenerVentas();
    const today = new Date();
    const hoy = sales.filter(
      (sale) => new Date(sale.date).toDateString() === today.toDateString(),
    );
    const resumen: Record<string, unknown> = {
      ventasHoy: hoy.reduce((sum, sale) => sum + sale.total, 0),
      transaccionesHoy: hoy.length,
    };
    if (!esAdmin) return resumen;

    const products = await this.obtenerProductos();
    const stockBajo = products.filter((product) =>
      product.variants.some((variant) => variant.stock <= variant.minStock),
    );
    return {
      ...resumen,
      productosActivos: products.length,
      unidadesEnStock: products.reduce(
        (sum, product) => sum + product.stock,
        0,
      ),
      productosStockBajo: stockBajo,
      movimientosRecientes: await this.obtenerMovimientos(4),
    };
  }

  async obtenerEstadisticas(desde?: string, hasta?: string) {
    const inicio = desde ? new Date(`${desde}T00:00:00`) : null;
    const fin = hasta ? new Date(`${hasta}T23:59:59.999`) : null;
    if (
      (inicio && Number.isNaN(inicio.getTime())) ||
      (fin && Number.isNaN(fin.getTime())) ||
      (inicio && fin && inicio > fin)
    ) {
      throw new BadRequestException('El rango de fechas no es válido');
    }

    const ventas = (await this.obtenerVentas()).filter((venta) => {
      const fecha = new Date(venta.date);
      return (!inicio || fecha >= inicio) && (!fin || fecha <= fin);
    });
    const total = ventas.reduce((sum, venta) => sum + venta.total, 0);
    const productos = new Map<
      string,
      { name: string; quantity: number; total: number }
    >();
    const dias = new Map<string, { total: number; transacciones: number }>();
    const pagos = new Map<string, number>();
    let unidades = 0;
    for (const venta of ventas) {
      const fecha = new Date(venta.date).toISOString().slice(0, 10);
      const dia = dias.get(fecha) ?? { total: 0, transacciones: 0 };
      dia.total += venta.total;
      dia.transacciones += 1;
      dias.set(fecha, dia);
      pagos.set(venta.payment, (pagos.get(venta.payment) ?? 0) + venta.total);
      for (const item of venta.items) {
        unidades += item.quantity;
        const stats = productos.get(item.name) ?? {
          name: item.name,
          quantity: 0,
          total: 0,
        };
        stats.quantity += item.quantity;
        stats.total += item.quantity * item.price;
        productos.set(item.name, stats);
      }
    }
    return {
      total,
      transacciones: ventas.length,
      promedio: ventas.length ? total / ventas.length : 0,
      unidades,
      ventasPorDia: [...dias].map(([fecha, valores]) => ({
        fecha,
        ...valores,
      })),
      ventasPorMetodo: [...pagos].map(([metodo, monto]) => ({
        metodo,
        monto,
      })),
      productosMasVendidos: [...productos.values()].sort(
        (a, b) => b.quantity - a.quantity,
      ),
    };
  }

  private async obtenerCategoria(id: number) {
    const [categoria] = await this.database.db
      .select()
      .from(categoriasInventario)
      .where(eq(categoriasInventario.id, id))
      .limit(1);
    if (!categoria) throw new NotFoundException('Categoría no encontrada');
    return categoria;
  }

  private async obtenerProductosConVariantes() {
    const productos = await this.database.db
      .select({
        producto: productosInventario,
        categoriaNombre: categoriasInventario.nombre,
      })
      .from(productosInventario)
      .innerJoin(
        categoriasInventario,
        eq(productosInventario.categoriaId, categoriasInventario.id),
      )
      .where(eq(productosInventario.activo, true))
      .orderBy(productosInventario.nombre);
    if (!productos.length) return [];

    const variantes = await this.database.db
      .select({
        variante: variantesProductoInventario,
        tallaNombre: tallasInventario.nombre,
      })
      .from(variantesProductoInventario)
      .innerJoin(
        tallasInventario,
        eq(variantesProductoInventario.tallaId, tallasInventario.id),
      )
      .where(
        inArray(
          variantesProductoInventario.productoId,
          productos.map(({ producto }) => producto.id),
        ),
      )
      .orderBy(tallasInventario.orden, tallasInventario.id);
    const variantesPorProducto = new Map<
      number,
      Array<{
        id: number;
        tallaId: number;
        size: string;
        sku: string;
        barcode: string;
        stock: number;
        minStock: number;
      }>
    >();
    for (const { variante, tallaNombre } of variantes) {
      const lista = variantesPorProducto.get(variante.productoId) ?? [];
      lista.push({
        id: variante.id,
        tallaId: variante.tallaId,
        size: tallaNombre,
        sku: variante.sku,
        barcode: variante.codigoBarras,
        stock: variante.existencia,
        minStock: variante.stockMinimo,
      });
      variantesPorProducto.set(variante.productoId, lista);
    }
    return Promise.all(
      productos.map(({ producto, categoriaNombre }) =>
        this.formatearProductoConVariantes(
          producto,
          categoriaNombre,
          variantesPorProducto.get(producto.id) ?? [],
        ),
      ),
    );
  }

  private async formatearProductoConVariantes(
    producto: ProductoInventario,
    categoriaNombre: string,
    variantes?: Array<{
      id: number;
      tallaId: number;
      size: string;
      sku: string;
      barcode: string;
      stock: number;
      minStock: number;
    }>,
  ) {
    if (producto.categoriaId === null) {
      throw new Error(`El producto ${producto.id} no tiene categoría asignada`);
    }
    const variantesProducto =
      variantes ??
      (await this.database.db
        .select({
          id: variantesProductoInventario.id,
          tallaId: variantesProductoInventario.tallaId,
          size: tallasInventario.nombre,
          sku: variantesProductoInventario.sku,
          barcode: variantesProductoInventario.codigoBarras,
          stock: variantesProductoInventario.existencia,
          minStock: variantesProductoInventario.stockMinimo,
        })
        .from(variantesProductoInventario)
        .innerJoin(
          tallasInventario,
          eq(variantesProductoInventario.tallaId, tallasInventario.id),
        )
        .where(eq(variantesProductoInventario.productoId, producto.id))
        .orderBy(tallasInventario.orden, tallasInventario.id));
    return {
      id: producto.id,
      name: producto.nombre,
      sku: producto.sku,
      barcode: producto.codigoBarras,
      categoryId: producto.categoriaId,
      category: categoriaNombre,
      price: producto.precio,
      unitsPerBox: producto.unidadesPorCaja,
      boxPrice: producto.precioCaja,
      stock: variantesProducto.reduce(
        (total, variante) => total + variante.stock,
        0,
      ),
      minStock: variantesProducto.reduce(
        (total, variante) => total + variante.minStock,
        0,
      ),
      variants: variantesProducto,
    };
  }

  private validarConfiguracionCaja(
    unidadesPorCaja: number | null | undefined,
    precioCaja: number | null | undefined,
  ) {
    if (unidadesPorCaja == null && precioCaja == null) return;
    if (
      unidadesPorCaja == null ||
      precioCaja == null ||
      !Number.isInteger(unidadesPorCaja) ||
      unidadesPorCaja < 2 ||
      !Number.isFinite(precioCaja) ||
      precioCaja <= 0
    ) {
      throw new BadRequestException(
        'Configura tanto las unidades por caja como un precio de caja válido',
      );
    }
  }

  private async obtenerTallaUnicaId(tx: InventarioTransaction) {
    const [talla] = await tx
      .select({ id: tallasInventario.id })
      .from(tallasInventario)
      .where(eq(tallasInventario.nombre, 'Única'))
      .limit(1);
    if (!talla) throw new NotFoundException('No existe la talla Única');
    return talla.id;
  }

  private async actualizarStockAgregado(
    tx: InventarioTransaction,
    productoId: number,
  ) {
    const variantes = await tx
      .select({
        existencia: variantesProductoInventario.existencia,
        stockMinimo: variantesProductoInventario.stockMinimo,
      })
      .from(variantesProductoInventario)
      .where(eq(variantesProductoInventario.productoId, productoId));
    await tx
      .update(productosInventario)
      .set({
        existencia: variantes.reduce(
          (total, variante) => total + variante.existencia,
          0,
        ),
        stockMinimo: variantes.reduce(
          (total, variante) => total + variante.stockMinimo,
          0,
        ),
        updatedAt: new Date(),
      })
      .where(eq(productosInventario.id, productoId));
  }

  private async resolverVarianteVenta(
    tx: InventarioTransaction,
    item: { productoId?: number; varianteId?: number },
  ) {
    if (item.varianteId && item.productoId) {
      throw new BadRequestException(
        'La venta debe especificar la variante o el producto, no ambos',
      );
    }
    if (item.varianteId) {
      const [variante] = await tx
        .select({ id: variantesProductoInventario.id })
        .from(variantesProductoInventario)
        .where(eq(variantesProductoInventario.id, item.varianteId))
        .limit(1);
      if (!variante) throw new NotFoundException('Variante no encontrada');
      return variante.id;
    }
    if (!item.productoId) {
      throw new BadRequestException('Cada artículo debe incluir una talla');
    }
    const variantes = await tx
      .select({ id: variantesProductoInventario.id })
      .from(variantesProductoInventario)
      .where(eq(variantesProductoInventario.productoId, item.productoId));
    if (!variantes.length) {
      throw new NotFoundException(`Producto ${item.productoId} no encontrado`);
    }
    if (variantes.length !== 1) {
      throw new BadRequestException(
        `Selecciona una talla para el producto ${item.productoId}`,
      );
    }
    return variantes[0].id;
  }
}
