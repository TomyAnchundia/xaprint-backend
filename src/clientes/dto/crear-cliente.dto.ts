import { IsNotEmpty, IsString } from 'class-validator';

export class CrearClienteDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  telefono!: string;
}
