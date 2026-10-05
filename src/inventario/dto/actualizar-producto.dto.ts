import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { VarianteProductoDto } from './crear-producto.dto';

export class ActualizarProductoDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  categoriaId?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precio?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  existencia?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockMinimo?: number;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(2147483647)
  unidadesPorCaja?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  precioCaja?: number | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VarianteProductoDto)
  variantes?: VarianteProductoDto[];
}
