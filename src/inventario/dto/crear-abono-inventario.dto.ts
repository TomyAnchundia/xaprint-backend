import {
  IsIn,
  IsNumber,
  IsPositive,
  Max,
} from 'class-validator';

export class CrearAbonoInventarioDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(2147483647)
  monto!: number;

  @IsIn(['Efectivo', 'Transferencia', 'Tarjeta'])
  metodoPago!: 'Efectivo' | 'Transferencia' | 'Tarjeta';
}
