import { IsBoolean } from 'class-validator';

export class ActivarTarifaEspecialDto {
  @IsBoolean()
  activo!: boolean;
}
