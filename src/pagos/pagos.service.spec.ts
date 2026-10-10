import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';

import { PagosService } from './pagos.service';

describe('PagosService', () => {
  let service: PagosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PagosService,
        { provide: DatabaseService, useValue: { db: {} } },
      ],
    }).compile();

    service = module.get<PagosService>(PagosService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rechaza un intervalo invertido aunque las fechas sean consecutivas', async () => {
    await expect(
      service.obtenerResumenPeriodo('2026-09-29', '2026-09-28'),
    ).rejects.toThrow('El inicio no puede ser posterior al fin');
  });

  it('registra el pago de un pedido antes de entregarlo', async () => {
    const valoresInsertados: unknown[] = [];
    const resultadosSelect = [
      [
        {
          id: 12,
          clienteId: 3,
          estado: 'REVISION',
          estadoPago: 'NO_PAGADO',
          valorCobrar: 25,
        },
      ],
      [{ pagado: 0 }],
    ];
    const tx = {
      select: jest.fn(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        all: jest.fn().mockImplementation(async () => resultadosSelect.shift()),
      })),
      insert: jest.fn(() => ({
        values: jest.fn((value: unknown) => {
          valoresInsertados.push(value);
          return {
            returning: jest.fn(() => ({
              all: jest.fn().mockResolvedValue([{ id: 91 }]),
            })),
            run: jest.fn().mockResolvedValue(undefined),
          };
        }),
      })),
      update: jest.fn(() => ({
        set: jest.fn(() => ({
          where: jest.fn(() => ({
            run: jest.fn().mockResolvedValue(undefined),
          })),
        })),
      })),
    };
    const database = {
      db: {
        transaction: async (callback: (tx: typeof tx) => Promise<unknown>) =>
          callback(tx),
      },
    };
    const serviceConBaseDeDatos = new PagosService(
      database as unknown as DatabaseService,
    );

    await expect(
      serviceConBaseDeDatos.registrarPagoPedido(7, 12, 'Transferencia'),
    ).resolves.toMatchObject({
      pagoId: 91,
      pedidoId: 12,
      monto: 25,
      estadoPago: 'PAGADO',
    });
    expect(tx.insert).toHaveBeenCalledTimes(3);
    expect(valoresInsertados[0]).toMatchObject({
      clienteId: 3,
      monto: 25,
      metodoPago: 'Transferencia',
      usuarioId: 7,
    });
  });
});
