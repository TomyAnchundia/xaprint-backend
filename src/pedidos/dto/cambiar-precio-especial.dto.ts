import { IsDefined, IsNumber, IsOptional, Min } from 'class-validator';

export class CambiarPrecioEspecialDto {
  @IsDefined()
  @IsOptional()
  @IsNumber()
  @Min(0)
  precioEspecial!: number | null;
}
