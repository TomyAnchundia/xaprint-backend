import { IsInt, IsNumber, Min } from 'class-validator';

export class CrearPagoDto {
  @IsInt()
  clienteId!: number;

  @IsNumber()
  @Min(0.01)
  monto!: number;
}
