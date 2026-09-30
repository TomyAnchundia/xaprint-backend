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
});
