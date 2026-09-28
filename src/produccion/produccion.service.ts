import { BadRequestException, Injectable } from '@nestjs/common';
import { and, eq, gte, lt } from 'drizzle-orm';

import { DatabaseService } from '../database/database.service';
import { historialPedidos, pedidos } from '../database/schema';

type ResumenProduccion = {
  metros: number;
  total: number;
  aporteDesarrollador: number;
  ingresoNegocio: number;
};

@Injectable()
export class ProduccionService {
  constructor(private readonly database: DatabaseService) {}

  async obtenerPorFecha(fecha: string) {
    const inicio = this.obtenerInicioDiaUTC(fecha);
    const fin = this.obtenerInicioDiaUTC(this.sumarUnDia(fecha));

    const resultados = await this.database.db
      .select({
        pedidoId: pedidos.id,
        servicio: pedidos.servicio,
        ancho: pedidos.ancho,
        largo: pedidos.largo,
        valorCobrar: pedidos.valorCobrar,
        aporteDesarrollador: pedidos.aporteDesarrollador,
      })
      .from(historialPedidos)
      .innerJoin(pedidos, eq(historialPedidos.pedidoId, pedidos.id))
      .where(
        and(
          eq(historialPedidos.estadoNuevo, 'LISTO'),
          gte(historialPedidos.createdAt, inicio),
          lt(historialPedidos.createdAt, fin),
        ),
      );

    const textil58 = this.crearResumen();
    const textil31 = this.crearResumen();
    const uv = this.crearResumen();

    for (const pedido of resultados) {
      const resumen = this.obtenerResumenCorrespondiente(
        pedido.servicio,
        pedido.ancho,
        textil58,
        textil31,
        uv,
      );

      if (!resumen) {
        continue;
      }

      resumen.metros += (pedido.largo ?? 0) / 100;
      resumen.total += pedido.valorCobrar ?? 0;
      resumen.aporteDesarrollador += pedido.aporteDesarrollador ?? 0;
    }

    this.finalizarResumen(textil58);
    this.finalizarResumen(textil31);
    this.finalizarResumen(uv);

    const totalGeneral = this.crearResumen();

    this.acumularResumen(totalGeneral, textil58);
    this.acumularResumen(totalGeneral, textil31);
    this.acumularResumen(totalGeneral, uv);

    this.finalizarResumen(totalGeneral);

    return {
      fecha,
      textil58,
      textil31,
      uv,
      totalGeneral,
    };
  }

  private crearResumen(): ResumenProduccion {
    return {
      metros: 0,
      total: 0,
      aporteDesarrollador: 0,
      ingresoNegocio: 0,
    };
  }

  private obtenerResumenCorrespondiente(
    servicio: string,
    ancho: number,
    textil58: ResumenProduccion,
    textil31: ResumenProduccion,
    uv: ResumenProduccion,
  ): ResumenProduccion | null {
    if (servicio === 'TEXTIL' && ancho === 58) {
      return textil58;
    }

    if (servicio === 'TEXTIL' && ancho === 31) {
      return textil31;
    }

    if (servicio === 'UV') {
      return uv;
    }

    return null;
  }

  private finalizarResumen(resumen: ResumenProduccion): void {
    resumen.metros = Number(resumen.metros.toFixed(2));
    resumen.total = Number(resumen.total.toFixed(2));
    resumen.aporteDesarrollador = Number(
      resumen.aporteDesarrollador.toFixed(2),
    );

    resumen.ingresoNegocio = Number(
      (resumen.total - resumen.aporteDesarrollador).toFixed(2),
    );
  }

  private acumularResumen(
    destino: ResumenProduccion,
    origen: ResumenProduccion,
  ): void {
    destino.metros += origen.metros;
    destino.total += origen.total;
    destino.aporteDesarrollador += origen.aporteDesarrollador;
  }

  private obtenerInicioDiaUTC(fecha: string): Date {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      throw new BadRequestException('La fecha debe tener formato YYYY-MM-DD');
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);

    return new Date(Date.UTC(anio, mes - 1, dia, 5, 0, 0, 0));
  }

  private sumarUnDia(fecha: string): string {
    const [anio, mes, dia] = fecha.split('-').map(Number);

    const siguiente = new Date(Date.UTC(anio, mes - 1, dia + 1));

    return [
      siguiente.getUTCFullYear(),
      String(siguiente.getUTCMonth() + 1).padStart(2, '0'),
      String(siguiente.getUTCDate()).padStart(2, '0'),
    ].join('-');
  }
}
