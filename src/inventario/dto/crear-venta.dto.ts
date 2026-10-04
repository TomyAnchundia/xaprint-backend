import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsPositive,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ItemVentaDto {
  @IsInt()
  @IsPositive()
  productoId!: number;

  @IsInt()
  @IsPositive()
  @Max(2147483647)
  cantidad!: number;
}

export class CrearVentaDto {
  @IsInt()
  @IsPositive()
  clienteId!: number;

  @IsIn(['Efectivo', 'Transferencia', 'Tarjeta'])
  metodoPago!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemVentaDto)
  items!: ItemVentaDto[];
}
