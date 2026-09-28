import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class CambiarEstadoPedidoDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['REVISION', 'IMPRIMIENDO', 'LISTO', 'ENTREGADO', 'CANCELADO'])
  estado!: string;
}
