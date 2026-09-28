import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { ClientesModule } from './clientes/clientes.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { PreciosModule } from './precios/precios.module';
import { ProduccionModule } from './produccion/produccion.module';
import { PagosModule } from './pagos/pagos.module';
import { TarifasModule } from './tarifas/tarifas.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DatabaseModule,
    UsuariosModule,
    ClientesModule,
    PedidosModule,
    PreciosModule,
    ProduccionModule,
    PagosModule,
    TarifasModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
