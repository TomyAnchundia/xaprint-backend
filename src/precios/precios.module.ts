import { Module } from '@nestjs/common';

import { PreciosController } from './precios.controller';
import { PreciosService } from './precios.service';
import { TarifasModule } from '../tarifas/tarifas.module';

@Module({
  imports: [TarifasModule],
  controllers: [PreciosController],
  providers: [PreciosService],
  exports: [PreciosService],
})
export class PreciosModule {}
