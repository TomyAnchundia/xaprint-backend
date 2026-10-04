import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginInventarioDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
