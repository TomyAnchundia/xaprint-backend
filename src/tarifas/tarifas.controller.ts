import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TarifasService, ServicioTarifa } from './tarifas.service';

@Controller('tarifas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TarifasController {
  constructor(private readonly tarifasService: TarifasService) {}

  @Get()
  listar() {
    return this.tarifasService.listar();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.tarifasService.obtenerPorId(id);
  }

  @Post()
  crear(
    @Body()
    body: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    return this.tarifasService.crear(body);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    return this.tarifasService.actualizar(id, body);
  }

  @Patch(':id/activo')
  cambiarActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { activo: boolean },
  ) {
    return this.tarifasService.cambiarActivo(id, body.activo);
  }
}
