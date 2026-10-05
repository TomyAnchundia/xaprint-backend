import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  Min,
  IsPositive,
  IsOptional,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ItemVentaDto {
  @IsOptional()
  @IsInt()
  @IsPositive()
  productoId?: number;

  @IsOptional()
  @IsInt()
  @IsPositive()
  varianteId?: number;

  @IsInt()
  @IsPositive()
  @Max(2147483647)
  cantidad!: number;

  @IsOptional()
  @IsIn(['UNIDAD', 'CAJA'])
  presentacion?: 'UNIDAD' | 'CAJA';
}

export class CrearVentaDto {
  @IsInt()
  @IsPositive()
  clienteId!: number;

  @IsIn(['Efectivo', 'Transferencia', 'Tarjeta', 'Crédito'])
  metodoPago!: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(2147483647)
  abonoInicial?: number;

  @IsOptional()
  @IsIn(['Efectivo', 'Transferencia', 'Tarjeta'])
  metodoAbonoInicial?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items!: ItemVentaDto[];
}
