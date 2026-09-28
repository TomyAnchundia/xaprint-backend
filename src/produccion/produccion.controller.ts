import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ProduccionService } from './produccion.service';

@Controller('produccion')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class ProduccionController {
  constructor(private readonly produccionService: ProduccionService) {}

  @Get()
  obtenerPorFecha(@Query('fecha') fecha: string) {
    return this.produccionService.obtenerPorFecha(fecha);
  }
}
