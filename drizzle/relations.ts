import { relations } from 'drizzle-orm';
import { clientes, pedidos } from './schema';

export const pedidosRelations = relations(pedidos, ({ one }) => ({
  cliente: one(clientes, {
    fields: [pedidos.clienteId],
    references: [clientes.id],
  }),
}));

export const clientesRelations = relations(clientes, ({ many }) => ({
  pedidos: many(pedidos),
}));
