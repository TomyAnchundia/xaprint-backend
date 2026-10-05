import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearTallaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  nombre!: string;
}
