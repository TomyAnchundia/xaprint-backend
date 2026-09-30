import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const usuarios = sqliteTable('usuarios', {
  id: integer('id').primaryKey({ autoIncrement: true }),

  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  rol: text('rol').default('EMPLEADO'),
  area: text('area').default('TEXTIL31'),
});

export const clientes = sqliteTable('clientes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  nombre: text('nombre').notNull(),
  telefono: text('telefono').notNull().unique(),
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
