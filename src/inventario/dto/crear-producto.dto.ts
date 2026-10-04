import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CrearProductoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  nombre!: string;

  @IsInt()
  @Min(1)
  categoriaId!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precio!: number;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  existencia!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockMinimo?: number;
}
