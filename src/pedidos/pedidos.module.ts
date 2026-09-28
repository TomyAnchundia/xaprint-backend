import { Module } from '@nestjs/common';

import { PedidosController } from './pedidos.controller';
import { PedidosGateway } from './pedidos.gateway';
import { PedidosService } from './pedidos.service';

import { PreciosModule } from '../precios/precios.module';

@Module({
  imports: [PreciosModule],

  controllers: [PedidosController],

  providers: [PedidosService, PedidosGateway],
  exports: [PedidosGateway],
})
export class PedidosModule {}
