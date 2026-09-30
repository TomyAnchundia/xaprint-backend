import {
  Body,
  Controller,
  Get,
  Param,
  ParseFloatPipe,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';

import { PreciosService } from './precios.service';
import { CalcularPrecioDto } from './precios.dto';

@Controller('precios')
export class PreciosController {
  constructor(private readonly preciosService: PreciosService) {}

  @Get('tarifa/:id')
  calcularCotizacionTarifa(
    @Param('id', ParseIntPipe) tarifaId: number,
    @Query('largo', ParseFloatPipe) largoCm: number,
  ) {
    return this.preciosService.calcularCotizacionTarifa(tarifaId, largoCm);
  }

  @Post('calcular')
  async calcularPrecio(@Body() dto: CalcularPrecioDto) {
    return this.preciosService.calcularCotizacion(
      dto.servicio,
      dto.ancho,
      dto.largo,
      dto.costoDiseno ?? 0,
    );
  }
}
