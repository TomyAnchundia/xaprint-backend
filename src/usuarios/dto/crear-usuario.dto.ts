import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty()
  username!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;

  @IsString()
  @IsIn(['ADMIN', 'DISENADOR', 'EMPLEADO'])
  rol!: string;

  @IsString()
  @IsIn(['TEXTIL31', 'TEXTIL58', 'UV'])
  area!: string;
}
