import { IsNumber, Matches, Min } from 'class-validator';

export class CrearPagoDesarrolladorDto {
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  periodo!: string;

  @IsNumber()
  @Min(0.01)
  monto!: number;
}
