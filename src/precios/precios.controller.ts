import { Body, Controller, Post } from '@nestjs/common';

import { PreciosService } from './precios.service';
import { CalcularPrecioDto } from './precios.dto';

@Controller('precios')
export class PreciosController {
  constructor(private readonly preciosService: PreciosService) {}

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
