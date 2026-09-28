import { BadRequestException, Injectable } from '@nestjs/common';

import { TarifasService, ServicioTarifa } from '../tarifas/tarifas.service';

@Injectable()
export class PreciosService {
  constructor(private readonly tarifasService: TarifasService) {}

  async calcularPrecio(
    servicio: ServicioTarifa,
    ancho: number,
    largoCm: number,
  ): Promise<number> {
    this.validarLargo(largoCm);

    const tarifa = await this.tarifasService.obtenerTarifaAplicable(
      servicio,
      ancho,
      largoCm,
    );

    if (!tarifa) {
      throw new BadRequestException(
        `No existe una tarifa activa para ${servicio} ${ancho} cm y ${largoCm} cm de largo`,
      );
    }

    const largoM = largoCm / 100;
    const precio = largoM * tarifa.precio;

    return this.redondear(precio);
  }

  async calcularCotizacion(
    servicio: ServicioTarifa,
    ancho: number,
    largoCm: number,
    costoDiseno = 0,
  ) {
    const precioCalculado = await this.calcularPrecio(servicio, ancho, largoCm);

    if (!Number.isFinite(costoDiseno) || costoDiseno < 0) {
      throw new BadRequestException(
        'El costo de diseño debe ser mayor o igual a 0',
      );
    }

    const costoDisenoRedondeado = this.redondear(costoDiseno);

    let aporteDesarrollador = 0;
    let valorCobrar = precioCalculado + costoDisenoRedondeado;

    /*
     * TEXTIL 58 cm:
     * desde 300 cm no aplica aporte/redondeo.
     */
    if (servicio === 'TEXTIL' && ancho === 58 && largoCm >= 300) {
      valorCobrar = this.redondear(valorCobrar);
    }

    /*
     * TEXTIL 31 cm y TEXTIL 58 cm
     * por debajo de 300 cm:
     *
     * El valor de impresión se redondea
     * hacia arriba al siguiente múltiplo de $0.05.
     */
    else if (servicio === 'TEXTIL') {
      const valorRedondeado =
        this.redondearHaciaArribaCincoCentavos(precioCalculado);

      aporteDesarrollador = this.redondear(valorRedondeado - precioCalculado);

      valorCobrar = this.redondear(valorRedondeado + costoDisenoRedondeado);
    }

    /*
     * UV:
     * no genera aporte del desarrollador.
     */
    else if (servicio === 'UV') {
      valorCobrar = this.redondear(precioCalculado + costoDisenoRedondeado);
    }

    return {
      precioCalculado,
      costoDiseno: costoDisenoRedondeado,
      aporteDesarrollador,
      valorCobrar,
    };
  }

  private validarLargo(largoCm: number): void {
    if (!Number.isFinite(largoCm) || largoCm <= 0) {
      throw new BadRequestException('El largo debe ser mayor que 0 cm');
    }
  }

  private redondear(valor: number): number {
    return Math.round((valor + Number.EPSILON) * 100) / 100;
  }

  private redondearHaciaArribaCincoCentavos(valor: number): number {
    return this.redondear(Math.ceil((valor - 0.000001) / 0.05) * 0.05);
  }
}
