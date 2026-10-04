import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import {
  categoriasInventario,
  clientes,
  itemsVentaInventario,
  movimientosInventario,
  pagos,
  pedidos,
  productosInventario,
  usuariosInventario,
  ventasInventario,
} from '../database/schema';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { ActualizarUsuarioInventarioDto } from './dto/actualizar-usuario-inventario.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
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

@Injectable()
export class InventarioService {
  constructor(private readonly database: DatabaseService) {}

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
    return this.database.db.select().from(clientes).orderBy(clientes.nombre);
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
    const rows = await this.database.db
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
    return rows.map((row) =>
      this.formatearProducto(row.producto, row.categoriaNombre),
    );
  }

  async obtenerProductosParaVenta() {
    const rows = await this.database.db
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
    return rows.map((row) =>
      this.formatearProducto(row.producto, row.categoriaNombre),
    );
  }

  async crearProducto(
    datos: CrearProductoDto,
    usuario: UsuarioInventarioActual,
  ) {
    const categoria = await this.obtenerCategoria(datos.categoriaId);
    const producto = await this.database.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(productosInventario)
        .values({
          nombre: datos.nombre,
          sku: 'SKU-PENDING',
          codigoBarras: 'SKU-PENDING',
          categoriaId: categoria.id,
          precio: datos.precio,
          existencia: datos.existencia,
          stockMinimo: datos.stockMinimo ?? 0,
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
      if (row.existencia > 0) {
        await tx.insert(movimientosInventario).values({
          productoId: productoCreado.id,
          productoNombre: productoCreado.nombre,
          usuarioId: usuario.id,
          tipo: 'Ingreso',
          cantidad: productoCreado.existencia,
        });
      }
      return productoCreado;
    });
    return this.formatearProducto(producto, categoria.nombre);
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
      if (datos.stockMinimo !== undefined) {
        cambios.stockMinimo = datos.stockMinimo;
      }
      if (datos.existencia !== undefined) {
        const diferencia = datos.existencia - producto.existencia;
        cambios.existencia = datos.existencia;
        if (diferencia !== 0) {
          await tx.insert(movimientosInventario).values({
            productoId: id,
            productoNombre: producto.nombre,
            usuarioId: usuario.id,
            tipo: diferencia > 0 ? 'Ingreso' : 'Salida',
            cantidad: Math.abs(diferencia),
          });
        }
      }

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
    return this.formatearProducto(resultado, categoriaNombre);
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
      const [producto] = await tx
        .select()
        .from(productosInventario)
        .where(
          and(
            eq(productosInventario.id, datos.productoId),
            eq(productosInventario.activo, true),
          ),
        )
        .limit(1);
      if (!producto) throw new NotFoundException('Producto no encontrado');

      const nuevoStock =
        datos.tipo === 'Ingreso'
          ? producto.existencia + datos.cantidad
          : producto.existencia - datos.cantidad;
      if (nuevoStock < 0) {
        throw new BadRequestException('No hay existencias suficientes');
      }
      if (!Number.isSafeInteger(nuevoStock)) {
        throw new BadRequestException('La cantidad supera el límite permitido');
      }

      await tx
        .update(productosInventario)
        .set({ existencia: nuevoStock, updatedAt: new Date() })
        .where(eq(productosInventario.id, producto.id));
      const [movimiento] = await tx
        .insert(movimientosInventario)
        .values({
          productoId: producto.id,
          productoNombre: producto.nombre,
          usuarioId: usuario.id,
          tipo: datos.tipo,
          cantidad: datos.cantidad,
        })
        .returning();
      return {
        id: movimiento.id,
        productId: movimiento.productoId,
        productName: movimiento.productoNombre,
        type: movimiento.tipo,
        quantity: movimiento.cantidad,
        date: movimiento.createdAt,
        user: usuario.username,
      };
    });
  }

  async crearVenta(datos: CrearVentaDto, usuario: UsuarioInventarioActual) {
    const cantidades = new Map<number, number>();
    for (const item of datos.items) {
      cantidades.set(
        item.productoId,
        (cantidades.get(item.productoId) ?? 0) + item.cantidad,
      );
    }

    return this.database.db.transaction(async (tx) => {
      const [cliente] = await tx
        .select()
        .from(clientes)
        .where(eq(clientes.id, datos.clienteId))
        .limit(1);
      if (!cliente) throw new NotFoundException('Cliente no encontrado');

      const items: {
        producto: ProductoInventario;
        cantidad: number;
        total: number;
      }[] = [];
      for (const [productoId, cantidad] of cantidades) {
        const [producto] = await tx
          .select()
          .from(productosInventario)
          .where(
            and(
              eq(productosInventario.id, productoId),
              eq(productosInventario.activo, true),
            ),
          )
          .limit(1);
        if (!producto) {
          throw new NotFoundException(`Producto ${productoId} no encontrado`);
        }
        if (producto.existencia < cantidad) {
          throw new BadRequestException(
            `Existencias insuficientes para ${producto.nombre}`,
          );
        }
        items.push({
          producto,
          cantidad,
          total: Math.round(producto.precio * cantidad * 100) / 100,
        });
      }

      const total =
        Math.round(items.reduce((sum, item) => sum + item.total, 0) * 100) /
        100;
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
        items.map(({ producto, cantidad, total: itemTotal }) => ({
          ventaId: venta.id,
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidad,
          precio: producto.precio,
          total: itemTotal,
        })),
      );

      for (const { producto, cantidad } of items) {
        await tx
          .update(productosInventario)
          .set({
            existencia: producto.existencia - cantidad,
            updatedAt: new Date(),
          })
          .where(eq(productosInventario.id, producto.id));
        await tx.insert(movimientosInventario).values({
          productoId: producto.id,
          productoNombre: producto.nombre,
          usuarioId: usuario.id,
          tipo: 'Venta',
          cantidad,
        });
      }

      return {
        id: `V-${venta.id}`,
        date: venta.createdAt,
        customerId: cliente.id,
        customerName: cliente.nombre,
        customerPhone: cliente.telefono,
        items: items.map(({ producto, cantidad }) => ({
          productId: producto.id,
          name: producto.nombre,
          quantity: cantidad,
          price: producto.precio,
        })),
        payment: venta.metodoPago,
        total,
      };
    });
  }

  async actualizarVenta(
    id: number,
    datos: CrearVentaDto,
    usuario: UsuarioInventarioActual,
  ) {
    const cantidades = new Map<number, number>();
    for (const item of datos.items) {
      cantidades.set(
        item.productoId,
        (cantidades.get(item.productoId) ?? 0) + item.cantidad,
      );
    }

    return this.database.db.transaction(async (tx) => {
      const [venta] = await tx
        .select()
        .from(ventasInventario)
        .where(eq(ventasInventario.id, id))
        .limit(1);
      if (!venta) throw new NotFoundException('Venta no encontrada');

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
        cantidadesAnteriores.set(
          linea.productoId,
          (cantidadesAnteriores.get(linea.productoId) ?? 0) + linea.cantidad,
        );
      }

      const idsProductos = new Set([
        ...cantidadesAnteriores.keys(),
        ...cantidades.keys(),
      ]);
      const existenciasNuevas = new Map<number, number>();
      const productos = new Map<number, ProductoInventario>();
      const items: {
        producto: ProductoInventario;
        cantidad: number;
        total: number;
      }[] = [];

      for (const productoId of idsProductos) {
        const [producto] = await tx
          .select()
          .from(productosInventario)
          .where(eq(productosInventario.id, productoId))
          .limit(1);
        if (!producto) {
          throw new NotFoundException(`Producto ${productoId} no encontrado`);
        }
        productos.set(productoId, producto);
        const cantidadAnterior = cantidadesAnteriores.get(productoId) ?? 0;
        const cantidadNueva = cantidades.get(productoId) ?? 0;
        if (!producto.activo && cantidadNueva > cantidadAnterior) {
          throw new BadRequestException(
            `El producto ${producto.nombre} ya no está disponible`,
          );
        }
        const existenciaDisponible = producto.existencia + cantidadAnterior;
        if (existenciaDisponible < cantidadNueva) {
          throw new BadRequestException(
            `Existencias insuficientes para ${producto.nombre}`,
          );
        }
        existenciasNuevas.set(productoId, existenciaDisponible - cantidadNueva);
        if (cantidadNueva > 0) {
          items.push({
            producto,
            cantidad: cantidadNueva,
            total: Math.round(producto.precio * cantidadNueva * 100) / 100,
          });
        }
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
        items.map(({ producto, cantidad, total: itemTotal }) => ({
          ventaId: id,
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidad,
          precio: producto.precio,
          total: itemTotal,
        })),
      );

      for (const productoId of idsProductos) {
        const producto = productos.get(productoId)!;
        const cantidadAnterior = cantidadesAnteriores.get(productoId) ?? 0;
        const cantidadNueva = cantidades.get(productoId) ?? 0;
        const diferencia = cantidadNueva - cantidadAnterior;
        await tx
          .update(productosInventario)
          .set({
            existencia: existenciasNuevas.get(productoId)!,
            updatedAt: new Date(),
          })
          .where(eq(productosInventario.id, productoId));
        if (diferencia !== 0) {
          await tx.insert(movimientosInventario).values({
            productoId,
            productoNombre: producto.nombre,
            usuarioId: usuario.id,
            tipo: diferencia > 0 ? 'Venta' : 'Ingreso',
            cantidad: Math.abs(diferencia),
          });
        }
      }

      return {
        id: `V-${venta.id}`,
        date: venta.createdAt,
        customerId: cliente.id,
        customerName: cliente.nombre,
        customerPhone: cliente.telefono,
        items: items.map(({ producto, cantidad }) => ({
          productId: producto.id,
          name: producto.nombre,
          quantity: cantidad,
          price: producto.precio,
        })),
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
      .orderBy(desc(ventasInventario.createdAt));
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
    return ventas.map((venta) => ({
      ...venta,
      id: `V-${venta.id}`,
      items: lineas
        .filter((item) => item.ventaId === venta.id)
        .map((item) => ({
          productId: item.productoId,
          name: item.productoNombre,
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
    const stockBajo = products.filter(
      (product) => product.stock <= product.minStock,
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

  private formatearProducto(
    producto: ProductoInventario,
    categoriaNombre: string,
  ) {
    if (producto.categoriaId === null) {
      throw new Error(`El producto ${producto.id} no tiene categoría asignada`);
    }
    return {
      id: producto.id,
      name: producto.nombre,
      sku: producto.sku,
      barcode: producto.codigoBarras,
      categoryId: producto.categoriaId,
      category: categoriaNombre,
      price: producto.precio,
      stock: producto.existencia,
      minStock: producto.stockMinimo,
    };
  }
}
