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

    return this.calcularCotizacionDesdePrecio(
      precioCalculado,
      null,
      costoDiseno,
    );
  }

  calcularCotizacionDesdePrecio(
    precioCalculado: number | null,
    precioEspecial: number | null = null,
    costoDiseno = 0,
  ) {
    if (precioCalculado === null) {
      return {
        precioCalculado: null,
        costoDiseno: this.redondear(costoDiseno),
        aporteDesarrollador: 0,
        valorCobrar: costoDiseno > 0 ? this.redondear(costoDiseno) : null,
      };
    }

    if (precioEspecial !== null) {
      if (!Number.isFinite(costoDiseno) || costoDiseno < 0) {
        throw new BadRequestException(
          'El costo de diseño debe ser mayor o igual a 0',
        );
      }
      return {
        precioCalculado,
        costoDiseno: this.redondear(costoDiseno),
        aporteDesarrollador: 0.05,
        valorCobrar: this.redondear(precioEspecial + costoDiseno),
      };
    }

    return this.crearCotizacion(precioCalculado, costoDiseno);
  }

  async calcularCotizacionTarifa(tarifaId: number, largoCm: number) {
    this.validarLargo(largoCm);
    const tarifa = await this.tarifasService.obtenerPorId(tarifaId);
    if (
      largoCm < tarifa.desde ||
      (tarifa.hasta !== null && largoCm >= tarifa.hasta)
    ) {
      throw new BadRequestException(
        'El largo está fuera del rango de esta tarifa',
      );
    }

    const precioCalculado = this.redondear((largoCm / 100) * tarifa.precio);
    return this.crearCotizacion(precioCalculado);
  }

  private crearCotizacion(precioCalculado: number, costoDiseno = 0) {
    if (!Number.isFinite(costoDiseno) || costoDiseno < 0) {
      throw new BadRequestException(
        'El costo de diseño debe ser mayor o igual a 0',
      );
    }

    const costoDisenoRedondeado = this.redondear(costoDiseno);

    const valorRedondeado =
      this.redondearHaciaArribaCincoCentavos(precioCalculado);
    const aporteDesarrollador = this.redondear(
      valorRedondeado - precioCalculado,
    );
    const valorCobrar = this.redondear(valorRedondeado + costoDisenoRedondeado);

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
