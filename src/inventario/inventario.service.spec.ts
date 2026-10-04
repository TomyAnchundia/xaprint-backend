import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { DatabaseService } from '../database/database.service';
import { InventarioService } from './inventario.service';

describe('InventarioService', () => {
  let client: ReturnType<typeof createClient>;
  let service: InventarioService;

  beforeAll(async () => {
    client = createClient({ url: 'file::memory:' });
    await client.execute('PRAGMA foreign_keys = ON');
    await client.execute(
      'CREATE TABLE clientes (id integer PRIMARY KEY AUTOINCREMENT, nombre text NOT NULL, telefono text NOT NULL UNIQUE)',
    );
    await client.execute(
      'CREATE TABLE pedidos (id integer PRIMARY KEY AUTOINCREMENT, cliente_id integer NOT NULL)',
    );
    await client.execute(
      'CREATE TABLE pagos (id integer PRIMARY KEY AUTOINCREMENT, cliente_id integer NOT NULL)',
    );
    const migration = await readFile(
      resolve(
        __dirname,
        '../../migrations/20261004135416_inventario/migration.sql',
      ),
      'utf8',
    );
    await client.executeMultiple(migration);
    await client.execute({
      sql: `INSERT INTO productos_inventario
        (nombre, sku, codigo_barras, categoria, precio, existencia, stock_minimo, activo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'zz Producto legado',
        'OLD-001',
        'BC-OLD-001',
        'Legacy',
        1,
        0,
        0,
        1,
        Date.now(),
        Date.now(),
      ],
    });
    await client.execute({
      sql: `INSERT INTO productos_inventario
        (nombre, sku, codigo_barras, categoria, precio, existencia, stock_minimo, activo, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        'zz Producto sin categoría',
        'OLD-002',
        'BC-OLD-002',
        '',
        1,
        0,
        0,
        1,
        Date.now(),
        Date.now(),
      ],
    });
    const categoryMigration = await readFile(
      resolve(
        __dirname,
        '../../migrations/20261004142408_inventario_categorias/migration.sql',
      ),
      'utf8',
    );
    await client.executeMultiple(categoryMigration);
    const normalizationMigration = await readFile(
      resolve(
        __dirname,
        '../../migrations/20261004142610_normalizar_categoria_producto/migration.sql',
      ),
      'utf8',
    );
    await client.executeMultiple(normalizationMigration);
    const migratedProduct = await client.execute(
      `SELECT p.categoria_id, c.nombre AS categoria
       FROM productos_inventario p
       INNER JOIN categorias_inventario c ON c.id = p.categoria_id
       WHERE p.sku = 'OLD-001'`,
    );
    expect(migratedProduct.rows).toHaveLength(1);
    expect(migratedProduct.rows[0].categoria).toBe('Legacy');
    const uncategorizedProduct = await client.execute(
      `SELECT c.nombre AS categoria
       FROM productos_inventario p
       INNER JOIN categorias_inventario c ON c.id = p.categoria_id
       WHERE p.sku = 'OLD-002'`,
    );
    expect(uncategorizedProduct.rows[0].categoria).toBe('Sin categoría');
    const productColumns = await client.execute(
      'PRAGMA table_info(productos_inventario)',
    );
    expect(productColumns.rows.map((column) => column.name)).not.toContain(
      'categoria',
    );
    service = new InventarioService({
      db: drizzle({ client }),
    } as unknown as DatabaseService);
  });

  afterAll(async () => {
    await client.close();
  });

  it('keeps inventory accounts separate and records sales atomically', async () => {
    const admin = await service.crearPrimerAdministrador({
      username: 'inventario-admin',
      password: 'test-password-123',
      rol: 'ADMIN',
    });
    expect(
      await service.validarCredenciales(
        'inventario-admin',
        'test-password-123',
      ),
    ).toMatchObject({ id: admin.id, rol: 'ADMIN' });
    await expect(
      service.crearPrimerAdministrador({
        username: 'otro-admin',
        password: 'test-password-123',
        rol: 'ADMIN',
      }),
    ).rejects.toThrow('El administrador inicial de inventario ya fue creado');
    await expect(service.eliminarUsuario(admin.id, -1)).rejects.toThrow(
      'Debe permanecer al menos un administrador de inventario',
    );

    const cliente = await service.crearCliente({
      nombre: 'Cliente de prueba',
      telefono: '0990000000',
    });
    expect(cliente.cedula).toBeNull();
    expect(cliente.direccion).toBeNull();
    const clienteEditado = await service.actualizarCliente(cliente.id, {
      nombre: 'Cliente editado',
      cedula: '0912345678',
      direccion: 'Av. Principal',
    });
    expect(clienteEditado).toMatchObject({
      nombre: 'Cliente editado',
      telefono: '0990000000',
      cedula: '0912345678',
      direccion: 'Av. Principal',
    });
    await expect(
      service.crearCliente({
        nombre: 'Duplicado',
        telefono: '0990000000',
      }),
    ).rejects.toThrow('Ya existe un cliente con ese teléfono');

    const categoria = await service.crearCategoria({ nombre: 'Prueba' });
    const producto = await service.crearProducto(
      {
        nombre: 'Producto de prueba',
        categoriaId: categoria.id,
        precio: 2.5,
        existencia: 10,
        stockMinimo: 2,
      },
      admin,
    );
    expect(producto.sku).toMatch(/^XAP-\d{6}$/);
    expect(producto.barcode).toBe(`BC-${producto.sku}`);
    expect(producto).toMatchObject({
      categoryId: categoria.id,
      category: 'Prueba',
    });
    await expect(service.eliminarCategoria(categoria.id)).rejects.toThrow(
      'No se puede eliminar la categoría',
    );
    await service.actualizarCategoria(categoria.id, { nombre: 'Revisada' });
    expect((await service.obtenerProductos())[0].category).toBe('Revisada');
    const venta = await service.crearVenta(
      {
        clienteId: cliente.id,
        metodoPago: 'Efectivo',
        items: [{ productoId: producto.id, cantidad: 3 }],
      },
      admin,
    );

    expect(venta).toMatchObject({ id: 'V-1', total: 7.5 });
    expect((await service.obtenerProductos())[0].stock).toBe(7);
    expect((await service.obtenerVentas()).length).toBe(1);
    await expect(service.eliminarCliente(cliente.id)).rejects.toThrow(
      'No se puede eliminar un cliente con pedidos, pagos o ventas registrados',
    );
    const clienteSinRelaciones = await service.crearCliente({
      nombre: 'Cliente eliminable',
      telefono: '0990000001',
    });
    await expect(
      service.eliminarCliente(clienteSinRelaciones.id),
    ).resolves.toMatchObject({ id: clienteSinRelaciones.id, eliminado: true });
    expect(
      (await service.obtenerMovimientos()).map(({ type }) => type),
    ).toEqual(expect.arrayContaining(['Venta', 'Ingreso']));

    const ventaActualizada = await service.actualizarVenta(
      1,
      {
        clienteId: cliente.id,
        metodoPago: 'Transferencia',
        items: [{ productoId: producto.id, cantidad: 4 }],
      },
      admin,
    );
    expect(ventaActualizada).toMatchObject({
      id: 'V-1',
      total: 10,
      payment: 'Transferencia',
    });
    expect((await service.obtenerProductos())[0].stock).toBe(6);
    expect((await service.obtenerVentas())[0].items[0].quantity).toBe(4);

    await expect(
      service.actualizarVenta(
        1,
        {
          clienteId: cliente.id,
          metodoPago: 'Efectivo',
          items: [{ productoId: producto.id, cantidad: 20 }],
        },
        admin,
      ),
    ).rejects.toThrow('Existencias insuficientes');
    expect((await service.obtenerProductos())[0].stock).toBe(6);
    expect((await service.obtenerVentas())[0]).toMatchObject({
      payment: 'Transferencia',
      total: 10,
    });

    await expect(
      service.crearVenta(
        {
          clienteId: cliente.id,
          metodoPago: 'Efectivo',
          items: [{ productoId: producto.id, cantidad: 8 }],
        },
        admin,
      ),
    ).rejects.toThrow('Existencias insuficientes');
    expect((await service.obtenerProductos())[0].stock).toBe(6);
    expect((await service.obtenerVentas()).length).toBe(1);

    await expect(service.eliminarUsuario(admin.id, admin.id)).rejects.toThrow(
      'No puedes eliminar la cuenta con la que iniciaste sesión',
    );
    const normal = await service.crearUsuario({
      username: 'usuario-normal',
      password: 'test-password-123',
      rol: 'NORMAL',
    });
    await expect(
      service.crearUsuario({
        username: 'usuario-normal',
        password: 'test-password-123',
        rol: 'NORMAL',
      }),
    ).rejects.toThrow('Ya existe un usuario con ese nombre');
    await service.actualizarUsuario(normal.id, {
      username: 'usuario-normal-editado',
      password: 'new-test-password-123',
    });
    expect(
      await service.validarCredenciales(
        'usuario-normal-editado',
        'new-test-password-123',
      ),
    ).toMatchObject({ id: normal.id, rol: 'NORMAL' });
    await expect(service.eliminarUsuario(admin.id, -1)).rejects.toThrow(
      'No se puede eliminar un usuario con ventas o movimientos registrados',
    );
    await expect(service.eliminarUsuario(normal.id, -1)).resolves.toMatchObject(
      {
        id: normal.id,
        eliminado: true,
      },
    );
  });
});
