import { Test, TestingModule } from '@nestjs/testing';

import { DatabaseService } from '../database/database.service';

import { ProduccionService } from './produccion.service';

describe('ProduccionService', () => {
  let service: ProduccionService;
  const resultados = [
    {
      pedidoId: 1,
      fechaProduccion: new Date('2026-09-29T06:00:00.000Z'),
      servicio: 'TEXTIL',
      ancho: 58,
      largo: 100,
      valorCobrar: 10,
      aporteDesarrollador: 0.02,
    },
    {
      pedidoId: 1,
      fechaProduccion: new Date('2026-10-01T06:00:00.000Z'),
      servicio: 'TEXTIL',
      ancho: 58,
      largo: 100,
      valorCobrar: 10,
      aporteDesarrollador: 0.02,
    },
  ];

  beforeEach(async () => {
    const consulta = {
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockResolvedValue(resultados),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProduccionService,
        {
          provide: DatabaseService,
          useValue: { db: { select: jest.fn(() => consulta) } },
        },
      ],
    }).compile();

    service = module.get<ProduccionService>(ProduccionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('contabiliza un pedido una sola vez si vuelve a estar listo', async () => {
    const resumen = await service.obtenerPorFecha('2026-09-29');

    expect(resumen.totalGeneral.metros).toBe(1);
    expect(resumen.totalGeneral.total).toBe(10);
    expect(resumen.totalGeneral.aporteDesarrollador).toBe(0.02);
  });

  it('no vuelve a contar el mismo pedido en otra fecha', async () => {
    const resumen = await service.obtenerPorFecha('2026-10-01');

    expect(resumen.totalGeneral.metros).toBe(0);
    expect(resumen.totalGeneral.total).toBe(0);
  });
});
