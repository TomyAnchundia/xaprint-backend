import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ActualizarCategoriaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nombre!: string;
}
