import { Module } from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { ClientesController } from './clientes.controller';
import { PedidosModule } from '../pedidos/pedidos.module';

@Module({
  imports: [PedidosModule],
  providers: [ClientesService],
  controllers: [ClientesController],
})
export class ClientesModule {}
