import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CrearPedidoDto {
  @IsInt()
  @Min(1)
  clienteId!: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['TEXTIL', 'UV'])
  servicio!: string;

  @IsNumber()
  ancho!: number;

  @IsNumber()
  @Min(0)
  largo!: number;

  @IsOptional()
  @IsBoolean()
  contraer?: boolean;

  @IsOptional()
  @IsInt()
  @IsIn([83, 88])
  velocidad?: number;

  @IsOptional()
  @IsBoolean()
  obturacion?: boolean;

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
