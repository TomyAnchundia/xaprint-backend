import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class InventarioJwtStrategy extends PassportStrategy(
  Strategy,
  'jwt-inventario',
) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: {
    sub: number;
    username: string;
    rol: string;
    sistema: string;
  }) {
    if (
      payload.sistema !== 'INVENTARIO' ||
      !['ADMIN', 'NORMAL'].includes(payload.rol)
    ) {
      throw new UnauthorizedException('Token de inventario no válido');
    }

    return {
      id: payload.sub,
      username: payload.username,
      rol: payload.rol,
    };
  }
}
