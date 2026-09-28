import {
  sqliteTable,
  AnySQLiteColumn,
  uniqueIndex,
  integer,
  text,
  foreignKey,
  real,
} from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const usuarios = sqliteTable(
  'usuarios',
  {
    id: integer().primaryKey({ autoIncrement: true }).notNull(),
    username: text().notNull(),
    password: text().notNull(),
  },
  (table) => [uniqueIndex('usuarios_username_unique').on(table.username)],
);

export const clientes = sqliteTable('clientes', {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  nombre: text().notNull(),
  telefono: text(),
  createdAt: integer('created_at').notNull(),
});

export const pedidos = sqliteTable('pedidos', {
  id: integer().primaryKey({ autoIncrement: true }).notNull(),
  clienteId: integer('cliente_id')
    .notNull()
    .references(() => clientes.id),
  estado: text().default('POR_REVISAR').notNull(),
  prioridad: integer().default(0).notNull(),
  observaciones: text(),
  fechaEntrega: integer('fecha_entrega'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  servicio: text().notNull(),
  ancho: real().notNull(),
  largo: real(),
  contraer: integer(),
  velocidad: integer(),
  obstruccion: integer(),
});
