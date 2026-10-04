import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RolesGuard } from '../auth/roles.guard';
import { InventarioAuthGuard } from './inventario-auth.guard';
import { InventarioController } from './inventario.controller';
import { InventarioJwtStrategy } from './inventario-jwt.strategy';
import { InventarioService } from './inventario.service';

@Module({
  imports: [AuthModule],
  controllers: [InventarioController],
  providers: [
    InventarioService,
    InventarioJwtStrategy,
    InventarioAuthGuard,
    RolesGuard,
  ],
})
export class InventarioModule {}
