import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActualizarClienteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nombre?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  telefono?: string;
}
