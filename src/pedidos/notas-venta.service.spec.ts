import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { DatabaseService } from '../database/database.service';
import { NotasVentaService } from './notas-venta.service';

describe('NotasVentaService', () => {
  it('retains the database provider token for Nest dependency injection', () => {
    const dependencies = Reflect.getMetadata(
      'design:paramtypes',
      NotasVentaService,
    ) as unknown[];

    expect(dependencies[0]).toBe(DatabaseService);
  });

  let client: ReturnType<typeof createClient>;
  let service: NotasVentaService;

  beforeAll(async () => {
    client = createClient({ url: 'file::memory:' });
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute(
      'CREATE TABLE clientes (id integer PRIMARY KEY AUTOINCREMENT, nombre text NOT NULL)',
    );
    await client.execute(
      `CREATE TABLE pedidos (
        id integer PRIMARY KEY AUTOINCREMENT,
        cliente_id integer NOT NULL,
        estado text NOT NULL DEFAULT 'REVISION',
        estado_pago text NOT NULL DEFAULT 'NO_PAGADO',
        servicio text NOT NULL,
        ancho real NOT NULL,
        largo real,
        valor_cobrar real,
        precio_especial real,
        precio_calculado real,
        FOREIGN KEY (cliente_id) REFERENCES clientes(id)
      )`,
    );
    const migration = await readFile(
      resolve(
        __dirname,
        '../../migrations/20261113042826_true_sentry/migration.sql',
      ),
      'utf8',
    );
    await client.executeMultiple(migration);
    service = new NotasVentaService({
      db: drizzle({ client }),
    } as unknown as DatabaseService);

    await client.executeMultiple(`
      INSERT INTO clientes (nombre) VALUES ('Tomy Anchundia'), ('Otro cliente');
      INSERT INTO pedidos
        (cliente_id, estado, estado_pago, servicio, ancho, largo, valor_cobrar, precio_especial, precio_calculado)
      VALUES
        (1, 'REVISION', 'NO_PAGADO', 'TEXTIL', 58, 100, 10.25, NULL, 10.25),
        (1, 'IMPRIMIENDO', 'NO_PAGADO', 'UV', 0, 0, 5.5, NULL, 5.5),
        (2, 'ENTREGADO', 'NO_PAGADO', 'TEXTIL', 31, 80, 8, NULL, 8),
        (1, 'REVISION', 'NO_PAGADO', 'UV', 0, 0, NULL, NULL, NULL),
        (1, 'LISTO', 'NO_PAGADO', 'TEXTIL', 31, 30, 7, NULL, 7),
        (1, 'ENTREGADO', 'NO_PAGADO', 'UV', 0, 0, 6, NULL, 6),
        (1, 'LISTO', 'PARCIALMENTE_PAGADO', 'UV', 0, 0, 4, NULL, 4),
        (1, 'CANCELADO', 'NO_PAGADO', 'TEXTIL', 31, 20, 3, NULL, 3),
        (1, 'REVISION', 'PAGADO', 'TEXTIL', 31, 20, 3, NULL, 3);
    `);
  });

  afterAll(() => {
    client.close();
  });

  it('issues a persistent serial once per idempotency key and validates the selection', async () => {
    await expect(
      service.emitir([1, 3], '35fef671-8216-4bdb-93da-1d3e2bab0484'),
    ).rejects.toThrow('un mismo cliente');
    await expect(
      service.emitir([4], '35fef671-8216-4bdb-93da-1d3e2bab0485'),
    ).rejects.toThrow('precio confirmado');

    const idempotencyKey = '35fef671-8216-4bdb-93da-1d3e2bab0486';
    const [primera, concurrente] = await Promise.all([
      service.emitir([1, 2], idempotencyKey),
      service.emitir([1, 2], idempotencyKey),
    ]);

    expect(primera).toMatchObject({
      numero: '000001',
      cliente: { nombre: 'Tomy Anchundia' },
      total: 15.75,
      pedidos: [
        { pedidoId: 1, valor: 10.25 },
        { pedidoId: 2, valor: 5.5 },
      ],
    });
    expect(concurrente).toMatchObject({ numero: primera.numero });
    expect(await service.emitir([1, 2], idempotencyKey)).toMatchObject({
      numero: primera.numero,
    });

    await expect(service.emitir([1], idempotencyKey)).rejects.toThrow(
      'otra selección',
    );

    const siguiente = await service.emitir(
      [1],
      '35fef671-8216-4bdb-93da-1d3e2bab0487',
    );
    expect(siguiente.numero).toBe('000002');

    const notas = await client.execute(
      'SELECT COUNT(*) AS cantidad FROM notas_venta',
    );
    expect(Number(notas.rows[0]?.cantidad)).toBe(2);
  });

  it('only emits unpaid notes for the allowed production states', async () => {
    await expect(
      service.emitirNoPagados([7], '35fef671-8216-4bdb-93da-1d3e2bab0488'),
    ).rejects.toThrow('Solo se pueden incluir pedidos no pagados');
    await expect(
      service.emitirNoPagados([8], '35fef671-8216-4bdb-93da-1d3e2bab0489'),
    ).rejects.toThrow('Solo se pueden incluir pedidos no pagados');
    await expect(
      service.emitirNoPagados([9], '35fef671-8216-4bdb-93da-1d3e2bab0490'),
    ).rejects.toThrow('Solo se pueden incluir pedidos no pagados');

    const nota = await service.emitirNoPagados(
      [1, 2, 5, 6],
      '35fef671-8216-4bdb-93da-1d3e2bab0491',
    );

    expect(nota.pedidos.map((pedido) => pedido.pedidoId)).toEqual([1, 2, 5, 6]);
  });
});
