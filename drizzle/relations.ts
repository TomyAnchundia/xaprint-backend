import { defineRelations } from 'drizzle-orm';

import { clientes, pedidos } from './schema';

export const relaciones = defineRelations({ clientes, pedidos }, (r) => ({
  pedidos: {
    cliente: r.one.pedidos({
      from: r.pedidos.clienteId,
      to: r.clientes.id,
    }),
  },

  clientes: {
    pedidos: r.many.pedidos(),
  },
}));
