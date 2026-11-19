import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ItemCotizacionDto {
  @IsInt()
  @IsPositive()
  varianteId!: number;

  @IsInt()
  @IsPositive()
  @Max(2147483647)
  cantidad!: number;

  @IsOptional()
  @IsIn(['UNIDAD', 'CAJA'])
  presentacion?: 'UNIDAD' | 'CAJA';

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(100)
  descuentoPorcentaje?: number;
}

export class CrearCotizacionDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  clienteId?: number;

  @IsString()
  @MaxLength(80)
  contactoNombre!: string;

  @IsString()
  @MaxLength(20)
  contactoTelefono!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0)
  @Max(100)
  descuentoPorcentaje?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemCotizacionDto)
  items!: ItemCotizacionDto[];
}
