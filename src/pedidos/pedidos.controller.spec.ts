import { Test, TestingModule } from '@nestjs/testing';
import { PedidosController } from './pedidos.controller';
import { NotasVentaService } from './notas-venta.service';
import { PedidoReferenciaService } from './pedido-referencia.service';
import { PedidosService } from './pedidos.service';

describe('PedidosController', () => {
  let controller: PedidosController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PedidosController],
      providers: [
        { provide: PedidosService, useValue: {} },
        { provide: PedidoReferenciaService, useValue: {} },
        { provide: NotasVentaService, useValue: {} },
      ],
    }).compile();

    controller = module.get<PedidosController>(PedidosController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
