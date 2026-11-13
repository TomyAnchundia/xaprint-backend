import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Min,
} from 'class-validator';

export class CrearNotaVentaDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  pedidoIds!: number[];

  @IsUUID('4')
  idempotencyKey!: string;
}
