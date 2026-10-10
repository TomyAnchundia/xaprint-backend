import {
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  rol: text('rol').default('EMPLEADO'),
  area: text('area').default('TEXTIL31'),
});

export const usuariosInventario = sqliteTable('usuarios_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  rol: text('rol').notNull().default('NORMAL'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const clientes = sqliteTable('clientes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  telefono: text('telefono').notNull().unique(),
  cedula: text('cedula'),
  direccion: text('direccion'),
  tarifaEspecial: integer('tarifa_especial', { mode: 'boolean' })
    .notNull()
    .default(false),
});

export const categoriasInventario = sqliteTable('categorias_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tallasInventario = sqliteTable('tallas_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull().unique(),
  orden: integer('orden').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const coloresInventario = sqliteTable('colores_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const productosInventario = sqliteTable('productos_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  sku: text('sku').notNull().unique(),
  codigoBarras: text('codigo_barras').notNull().unique(),
  categoriaId: integer('categoria_id').references(
    () => categoriasInventario.id,
  ),
  precio: real('precio').notNull(),
  unidadesPorCaja: integer('unidades_por_caja'),
  precioCaja: real('precio_caja'),
  existencia: integer('existencia').notNull().default(0),
  stockMinimo: integer('stock_minimo').notNull().default(0),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const variantesProductoInventario = sqliteTable(
  'variantes_producto_inventario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    productoId: integer('producto_id')
      .notNull()
      .references(() => productosInventario.id),
    tallaId: integer('talla_id')
      .notNull()
      .references(() => tallasInventario.id),
    colorId: integer('color_id').references(() => coloresInventario.id),
    sku: text('sku').notNull().unique(),
    codigoBarras: text('codigo_barras').notNull().unique(),
    existencia: integer('existencia').notNull().default(0),
    stockMinimo: integer('stock_minimo').notNull().default(0),
    precio: real('precio').notNull().default(0),
  },
  (table) => [
    uniqueIndex('uq_variantes_producto_talla_sin_color')
      .on(table.productoId, table.tallaId)
      .where(sql`${table.colorId} IS NULL`),
    uniqueIndex('uq_variantes_producto_talla_color')
      .on(table.productoId, table.tallaId, table.colorId)
      .where(sql`${table.colorId} IS NOT NULL`),
  ],
);

export const ventasInventario = sqliteTable('ventas_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clienteId: integer('cliente_id')
    .notNull()
    .references(() => clientes.id),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuariosInventario.id),
  metodoPago: text('metodo_pago').notNull(),
  subtotal: real('subtotal').notNull().default(0),
  descuentoPorcentaje: real('descuento_porcentaje').notNull().default(0),
  descuentoMonto: real('descuento_monto').notNull().default(0),
  total: real('total').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const abonosVentasInventario = sqliteTable(
  'abonos_ventas_inventario',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    ventaId: integer('venta_id')
      .notNull()
      .references(() => ventasInventario.id),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id),
    usuarioId: integer('usuario_id')
      .notNull()
      .references(() => usuariosInventario.id),
    monto: real('monto').notNull(),
    metodoPago: text('metodo_pago').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
      .notNull()
      .$defaultFn(() => new Date()),
  },
);

export const itemsVentaInventario = sqliteTable('items_venta_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ventaId: integer('venta_id')
    .notNull()
    .references(() => ventasInventario.id),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productosInventario.id),
  varianteId: integer('variante_id').references(
    () => variantesProductoInventario.id,
  ),
  tallaNombre: text('talla_nombre').notNull().default('Única'),
  presentacion: text('presentacion').notNull().default('UNIDAD'),
  unidadesPorPresentacion: integer('unidades_por_presentacion')
    .notNull()
    .default(1),
  productoNombre: text('producto_nombre').notNull(),
  cantidad: integer('cantidad').notNull(),
  precio: real('precio').notNull(),
  total: real('total').notNull(),
});

export const movimientosInventario = sqliteTable('movimientos_inventario', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  productoId: integer('producto_id')
    .notNull()
    .references(() => productosInventario.id),
  varianteId: integer('variante_id').references(
    () => variantesProductoInventario.id,
  ),
  tallaNombre: text('talla_nombre').notNull().default('Única'),
  productoNombre: text('producto_nombre').notNull(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuariosInventario.id),
  tipo: text('tipo').notNull(),
  cantidad: integer('cantidad').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pedidos = sqliteTable('pedidos', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  clienteId: integer('cliente_id')
    .notNull()
    .references(() => clientes.id),

  estado: text('estado').notNull().default('REVISION'),
  estadoPago: text('estado_pago').notNull().default('NO_PAGADO'),

  prioridad: integer('prioridad').notNull().default(0),

  servicio: text('servicio').notNull(),

  ancho: real('ancho').notNull(),

  largo: real('largo').notNull(),

  // Precio calculado automáticamente según las tarifas configuradas.
  precioCalculado: real('precio_calculado'),

  // Precio especial establecido manualmente.
  precioEspecial: real('precio_especial'),

  //monto destiado para el creador del software.
  aporteDesarrollador: real('aporte_desarrollador').default(0),

  valorCobrar: real('valor_cobrar'),

  costoDiseno: real('costo_diseno').notNull().default(0),
  // Usuario que estableció el precio especial.
  precioEspecialUsuarioId: integer('precio_especial_usuario_id').references(
    () => usuarios.id,
  ),
  // Fecha en que se estableció el precio especial.
  precioEspecialFecha: integer('precio_especial_fecha', {
    mode: 'timestamp',
  }),

  contraer: integer('contraer', {
    mode: 'boolean',
  }),

  velocidad: integer('velocidad'),

  obturacion: integer('obturacion', {
    mode: 'boolean',
  }),

  observaciones: text('observaciones'),

  fechaEntrega: integer('fecha_entrega', {
    mode: 'timestamp',
  }),

  createdAt: integer('created_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),

  updatedAt: integer('updated_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const historialPedidos = sqliteTable('historial_pedidos', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id),

  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id),

  estadoAnterior: text('estado_anterior'),

  estadoNuevo: text('estado_nuevo'),

  estadoPagoAnterior: text('estado_pago_anterior'),

  estadoPagoNuevo: text('estado_pago_nuevo'),

  createdAt: integer('created_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pagos = sqliteTable('pagos', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  clienteId: integer('cliente_id')
    .notNull()
    .references(() => clientes.id),

  monto: real('monto').notNull(),

  metodoPago: text('metodo_pago').notNull().default('Efectivo'),

  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id),

  createdAt: integer('created_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pagosPedidos = sqliteTable('pagos_pedidos', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  pagoId: integer('pago_id')
    .notNull()
    .references(() => pagos.id),

  pedidoId: integer('pedido_id')
    .notNull()
    .references(() => pedidos.id),

  monto: real('monto').notNull(),
});

export const pagosDesarrollador = sqliteTable('pagos_desarrollador', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  periodo: text('periodo').notNull(),
  monto: real('monto').notNull(),
  usuarioId: integer('usuario_id')
    .notNull()
    .references(() => usuarios.id),
  createdAt: integer('created_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tarifas = sqliteTable('tarifas', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  servicio: text('servicio').notNull(),

  ancho: real('ancho').notNull(),

  desde: real('desde').notNull(),

  hasta: real('hasta'),

  precio: real('precio').notNull(),

  activo: integer('activo', {
    mode: 'boolean',
  })
    .notNull()
    .default(true),

  createdAt: integer('created_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),

  updatedAt: integer('updated_at', {
    mode: 'timestamp',
  })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const tarifasClientes = sqliteTable('tarifas_clientes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  clienteId: integer('cliente_id')
    .notNull()
    .references(() => clientes.id),
  servicio: text('servicio').notNull(),
  ancho: real('ancho').notNull(),
  desde: real('desde').notNull(),
  hasta: real('hasta'),
  precio: real('precio').notNull(),
  activo: integer('activo', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
