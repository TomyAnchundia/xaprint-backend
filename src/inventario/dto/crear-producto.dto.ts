import {
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VarianteProductoDto {
  @IsInt()
  @Min(1)
  tallaId!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  colorId?: number;

  @IsInt()
  @Min(0)
  @Max(2147483647)
  existencia!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockMinimo?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precio?: number;
}

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

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  existencia!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(2147483647)
  unidadesPorCaja?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioCaja?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VarianteProductoDto)
  variantes?: VarianteProductoDto[];
}
