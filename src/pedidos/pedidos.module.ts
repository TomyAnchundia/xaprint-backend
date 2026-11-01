import { Module } from '@nestjs/common';

import { PedidosController } from './pedidos.controller';
import { PedidosGateway } from './pedidos.gateway';
import { PedidoReferenciaService } from './pedido-referencia.service';
import { PedidosService } from './pedidos.service';

import { PreciosModule } from '../precios/precios.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, PreciosModule],

  controllers: [PedidosController],

  providers: [PedidosService, PedidosGateway, PedidoReferenciaService],
  exports: [PedidosGateway, PedidosService],
})
export class PedidosModule {}
