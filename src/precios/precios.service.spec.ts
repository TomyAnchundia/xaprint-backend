import { BadRequestException } from '@nestjs/common';

import { TarifasService } from '../tarifas/tarifas.service';

import { PreciosService } from './precios.service';

describe('PreciosService', () => {
  const tarifasService = {
    obtenerPorId: jest.fn(),
    obtenerTarifaAplicable: jest.fn(),
    obtenerTarifaClienteAplicable: jest.fn(),
  };
  const service = new PreciosService(
    tarifasService as unknown as TarifasService,
  );

  beforeEach(() => {
    tarifasService.obtenerPorId.mockReset();
    tarifasService.obtenerTarifaAplicable.mockReset();
    tarifasService.obtenerTarifaClienteAplicable.mockReset();
  });

  it('cotiza el redondeo textil para una tarifa concreta', async () => {
    tarifasService.obtenerPorId.mockResolvedValue({
      servicio: 'TEXTIL',
      ancho: 31,
      desde: 0,
      hasta: 100,
      precio: 3.14,
      activo: false,
    });

    await expect(service.calcularCotizacionTarifa(1, 1)).resolves.toMatchObject(
      {
        precioCalculado: 0.03,
        aporteDesarrollador: 0.02,
        valorCobrar: 0.05,
      },
    );
  });

  it('redondea UV y calcula el aporte sobre la diferencia', async () => {
    tarifasService.obtenerPorId.mockResolvedValue({
      servicio: 'UV',
      ancho: 29,
      desde: 0,
      hasta: null,
      precio: 9.91,
      activo: true,
    });

    await expect(
      service.calcularCotizacionTarifa(2, 100),
    ).resolves.toMatchObject({
      precioCalculado: 9.91,
      aporteDesarrollador: 0.04,
      valorCobrar: 9.95,
    });
  });

  it('rechaza largos fuera del rango de la tarifa', async () => {
    tarifasService.obtenerPorId.mockResolvedValue({
      servicio: 'TEXTIL',
      ancho: 31,
      desde: 10,
      hasta: 20,
      precio: 3.14,
      activo: false,
    });

    await expect(
      service.calcularCotizacionTarifa(3, 20),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('redondea TEXTIL 58 por debajo de 300 cm', () => {
    expect(service.calcularCotizacionDesdePrecio(19.99)).toMatchObject({
      aporteDesarrollador: 0.01,
      valorCobrar: 20,
    });
  });

  it('redondea TEXTIL 58 desde 300 cm', () => {
    expect(service.calcularCotizacionDesdePrecio(59.97)).toMatchObject({
      aporteDesarrollador: 0.03,
      valorCobrar: 60,
    });
  });

  it('no añade aporte cuando el cálculo ya es múltiplo de cinco centavos', () => {
    expect(service.calcularCotizacionDesdePrecio(9.95)).toMatchObject({
      aporteDesarrollador: 0,
      valorCobrar: 9.95,
    });
  });

  it.each([
    ['TEXTIL', 31, 100, 9.91],
    ['TEXTIL', 58, 300, 19.99],
    ['UV', 29, 100, 9.91],
  ] as const)(
    'aplica la misma regla a %s de %s cm y %s cm de largo',
    async (servicio, ancho, largoCm, precioMetro) => {
      tarifasService.obtenerTarifaAplicable.mockResolvedValue({
        precio: precioMetro,
      });

      const cotizacion = await service.calcularCotizacion(
        servicio,
        ancho,
        largoCm,
      );

      expect(cotizacion.aporteDesarrollador).toBeGreaterThanOrEqual(0);
      expect(cotizacion.valorCobrar).toBe(largoCm === 300 ? 60 : 9.95);
    },
  );

  it('usa la tarifa exclusiva del cliente para calcular el pedido', async () => {
    tarifasService.obtenerTarifaClienteAplicable.mockResolvedValue({
      esEspecial: true,
      tarifa: { precio: 5 },
    });

    await expect(
      service.calcularCotizacion('TEXTIL', 31, 100, 0, 42),
    ).resolves.toMatchObject({
      precioCalculado: 5,
      valorCobrar: 5,
    });
    expect(tarifasService.obtenerTarifaAplicable).not.toHaveBeenCalled();
  });

  it('bloquea el cálculo si al cliente especial le falta ese rango', async () => {
    tarifasService.obtenerTarifaClienteAplicable.mockResolvedValue({
      esEspecial: true,
      tarifa: null,
    });

    await expect(
      service.calcularCotizacion('TEXTIL', 31, 100, 0, 42),
    ).rejects.toThrow('Falta configurar una tarifa exclusiva');
    expect(tarifasService.obtenerTarifaAplicable).not.toHaveBeenCalled();
  });
});
