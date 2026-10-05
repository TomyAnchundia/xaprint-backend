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
    const sizeVariantsMigration = await readFile(
      resolve(
        __dirname,
        '../../migrations/20261005001808_tallas_producto_variantes/migration.sql',
      ),
      'utf8',
    );
    await client.executeMultiple(sizeVariantsMigration);
    const packagingAndCreditMigration = await readFile(
      resolve(
        __dirname,
        '../../migrations/20261005005021_quick_lightspeed/migration.sql',
      ),
      'utf8',
    );
    await client.executeMultiple(packagingAndCreditMigration);
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
    const migratedVariant = await client.execute(
      `SELECT talla.nombre, variante.existencia
       FROM variantes_producto_inventario variante
       INNER JOIN tallas_inventario talla ON talla.id = variante.talla_id
       WHERE variante.sku = 'OLD-001'`,
    );
    expect(migratedVariant.rows).toMatchObject([
      { nombre: 'Única', existencia: 0 },
    ]);
    service = new InventarioService({
      db: drizzle({ client }),
    } as unknown as DatabaseService);
  });

  afterAll(() => {
    client.close();
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

    const tallaM = await service.crearTalla({ nombre: 'M' });
    const tallaL = await service.crearTalla({ nombre: 'L' });
    await expect(service.crearTalla({ nombre: 'm' })).rejects.toThrow(
      'La talla ya existe',
    );
    const productoConTallas = await service.crearProducto(
      {
        nombre: 'Camisa oversize negra',
        categoriaId: categoria.id,
        precio: 15,
        variantes: [
          { tallaId: tallaM.id, existencia: 2, stockMinimo: 1 },
          { tallaId: tallaL.id, existencia: 5, stockMinimo: 1 },
        ],
      },
      admin,
    );
    expect(productoConTallas).toMatchObject({
      stock: 7,
      variants: [
        { size: 'M', stock: 2 },
        { size: 'L', stock: 5 },
      ],
    });
    const ventaTallaM = await service.crearVenta(
      {
        clienteId: cliente.id,
        metodoPago: 'Efectivo',
        items: [
          {
            varianteId: productoConTallas.variants[0].id,
            cantidad: 1,
          },
        ],
      },
      admin,
    );
    expect(ventaTallaM.items).toMatchObject([{ size: 'M', quantity: 1 }]);
    expect(
      (await service.obtenerProductos()).find(
        (item) => item.id === productoConTallas.id,
      )?.variants,
    ).toMatchObject([
      { size: 'M', stock: 1 },
      { size: 'L', stock: 5 },
    ]);
    await service.registrarMovimiento(
      {
        varianteId: productoConTallas.variants[1].id,
        tipo: 'Ingreso',
        cantidad: 2,
      },
      admin,
    );
    expect(
      (await service.obtenerProductos()).find(
        (item) => item.id === productoConTallas.id,
      )?.stock,
    ).toBe(8);

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
    expect(
      (await service.obtenerProductos()).find((item) => item.id === producto.id)
        ?.stock,
    ).toBe(6);
    expect(
      (await service.obtenerVentas()).find((sale) => sale.id === 'V-1'),
    ).toMatchObject({
      payment: 'Transferencia',
      total: 10,
    });

    const tazas = await service.crearProducto(
      {
        nombre: 'Tazas blancas',
        categoriaId: categoria.id,
        precio: 1,
        unidadesPorCaja: 36,
        precioCaja: 33,
        existencia: 200,
      },
      admin,
    );
    const primeraVentaCredito = await service.crearVenta(
      {
        clienteId: cliente.id,
        metodoPago: 'Crédito',
        abonoInicial: 5,
        metodoAbonoInicial: 'Efectivo',
        items: [
          {
            varianteId: tazas.variants[0].id,
            cantidad: 2,
            presentacion: 'CAJA',
          },
          {
            varianteId: tazas.variants[0].id,
            cantidad: 1,
            presentacion: 'UNIDAD',
          },
        ],
      },
      admin,
    );
    expect(primeraVentaCredito).toMatchObject({
      total: 67,
      paid: 5,
      debt: 62,
      items: [
        {
          presentation: 'CAJA',
          unitsPerPresentation: 36,
          quantity: 2,
          price: 33,
        },
        {
          presentation: 'UNIDAD',
          unitsPerPresentation: 1,
          quantity: 1,
          price: 1,
        },
      ],
    });
    expect(
      (await service.obtenerProductos()).find(
        (item) => item.id === tazas.id,
      )?.stock,
    ).toBe(127);
    await expect(
      service.crearVenta(
        {
          clienteId: cliente.id,
          metodoPago: 'Efectivo',
          items: [
            {
              varianteId: tazas.variants[0].id,
              cantidad: 4,
              presentacion: 'CAJA',
            },
          ],
        },
        admin,
      ),
    ).rejects.toThrow('Existencias insuficientes');
    const segundaVentaCredito = await service.crearVenta(
      {
        clienteId: cliente.id,
        metodoPago: 'Crédito',
        items: [{ varianteId: tazas.variants[0].id, cantidad: 1 }],
      },
      admin,
    );
    expect(segundaVentaCredito.debt).toBe(1);
    await expect(
      service.actualizarVenta(
        Number(primeraVentaCredito.id.slice(2)),
        {
          clienteId: cliente.id,
          metodoPago: 'Efectivo',
          items: [{ varianteId: tazas.variants[0].id, cantidad: 1 }],
        },
        admin,
      ),
    ).rejects.toThrow('Las ventas a crédito no se pueden editar');
    const abono = await service.crearAbonoCliente(
      cliente.id,
      { monto: 60, metodoPago: 'Transferencia' },
      admin,
    );
    expect(abono).toMatchObject({
      monto: 60,
      saldoDeuda: 3,
      abonos: [{ ventaId: Number(primeraVentaCredito.id.slice(2)), monto: 60 }],
    });
    expect((await service.obtenerClientes()).find((item) => item.id === cliente.id))
      .toMatchObject({ saldoDeuda: 3 });
    const cuenta = await service.obtenerCuentaCliente(cliente.id);
    expect(cuenta).toMatchObject({
      saldoDeuda: 3,
      ventas: [
        { id: primeraVentaCredito.id, pagado: 65, saldo: 2 },
        { id: segundaVentaCredito.id, pagado: 0, saldo: 1 },
      ],
      abonos: [
        { venta: primeraVentaCredito.id, monto: 60 },
        { venta: primeraVentaCredito.id, monto: 5 },
      ],
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
    expect(
      (await service.obtenerProductos()).find((item) => item.id === producto.id)
        ?.stock,
    ).toBe(6);
    expect((await service.obtenerVentas()).length).toBe(4);

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
