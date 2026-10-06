import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CrearColorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  nombre!: string;
}
