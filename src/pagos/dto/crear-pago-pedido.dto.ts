import { IsIn, ValidateIf } from 'class-validator';

import type { MetodoPago } from './crear-pago-dto';

export class CrearPagoPedidoDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['Efectivo', 'Transferencia'])
  metodoPago?: MetodoPago;
}
