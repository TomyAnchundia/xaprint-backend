import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class CalcularPrecioDto {
  @IsIn(['TEXTIL', 'UV'])
  servicio!: 'TEXTIL' | 'UV';

  @IsNumber()
  @IsPositive()
  ancho!: number;

  @IsNumber()
  @IsPositive()
  largo!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoDiseno?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  clienteId?: number;
}
