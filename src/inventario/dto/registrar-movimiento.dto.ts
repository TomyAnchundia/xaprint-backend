import { IsIn, IsInt, IsOptional, IsPositive, Max } from 'class-validator';

export class RegistrarMovimientoDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  productoId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  varianteId?: number;

  @IsIn(['Ingreso', 'Salida'])
  tipo!: 'Ingreso' | 'Salida';

  @IsInt()
  @IsPositive()
  @Max(2147483647)
  cantidad!: number;
}
