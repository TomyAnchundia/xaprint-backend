import {
  IsIn,
  IsInt,
  IsNumber,
  Min,
  ValidateIf,
} from 'class-validator';

export type MetodoPago = 'Efectivo' | 'Transferencia';

export class CrearPagoDto {
  @IsInt()
  clienteId!: number;

  @IsNumber()
  @Min(0.01)
  monto!: number;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(['Efectivo', 'Transferencia'])
  metodoPago?: MetodoPago;
}
