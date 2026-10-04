import { IsIn, IsInt, IsPositive, Max } from 'class-validator';

export class RegistrarMovimientoDto {
  @IsInt()
  @IsPositive()
  productoId!: number;

  @IsIn(['Ingreso', 'Salida'])
  tipo!: 'Ingreso' | 'Salida';

  @IsInt()
  @IsPositive()
  @Max(2147483647)
  cantidad!: number;
}
