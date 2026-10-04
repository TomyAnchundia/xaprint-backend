import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CrearClienteDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  telefono!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cedula?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string | null;
}
