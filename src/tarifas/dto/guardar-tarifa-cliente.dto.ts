import { IsIn, IsNumber, IsOptional, Min } from 'class-validator';

export class GuardarTarifaClienteDto {
  @IsIn(['TEXTIL', 'UV'])
  servicio!: 'TEXTIL' | 'UV';

  @IsNumber()
  ancho!: number;

  @IsNumber()
  @Min(0)
  desde!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  hasta?: number | null;

  @IsNumber()
  @Min(0.01)
  precio!: number;
}
