import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ActualizarUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  username?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  password?: string;

  @IsOptional()
  @IsString()
  @IsIn(['ADMIN', 'DISENADOR', 'EMPLEADO'])
  rol?: string;

  @IsOptional()
  @IsString()
  @IsIn(['TEXTIL31', 'TEXTIL58', 'UV'])
  area?: string;
}
