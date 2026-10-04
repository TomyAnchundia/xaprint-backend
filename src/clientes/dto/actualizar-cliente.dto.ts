import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telefono?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  cedula?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(250)
  direccion?: string | null;
}
