import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class ActualizarPedidoDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  clienteId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['TEXTIL', 'UV'])
  servicio?: string;

  @IsOptional()
  @IsNumber()
  ancho?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  largo?: number;

  @IsOptional()
  @IsBoolean()
  contraer?: boolean | null;

  @IsOptional()
  @IsInt()
  @IsIn([83, 88])
  velocidad?: number | null;

  @IsOptional()
  @IsBoolean()
  obturacion?: boolean | null;

  @IsOptional()
  @IsString()
  observaciones?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  prioridad?: number;

  @IsOptional()
  @IsString()
  fechaEntrega?: string | null;

  @IsOptional()
  @IsNumber()
  @Min(0)
  costoDiseno?: number;
}
