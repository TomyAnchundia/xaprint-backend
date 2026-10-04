import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../auth/roles.guard';
import { DatabaseService } from '../database/database.service';
import { InventarioService } from './inventario.service';

describe('Inventario authorization', () => {
  it('retains the database provider token for Nest dependency injection', () => {
    const dependencies = Reflect.getMetadata(
      'design:paramtypes',
      InventarioService,
    ) as unknown[];

    expect(dependencies[0]).toBe(DatabaseService);
  });

  function autorizar(rol: string, permitidos: string[]) {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(permitidos),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }),
    } as unknown as ExecutionContext;
    return guard.canActivate(context);
  }

  it('denies NORMAL on admin-only endpoints', () => {
    expect(autorizar('NORMAL', ['ADMIN'])).toBe(false);
  });

  it('allows NORMAL where explicitly permitted', () => {
    expect(autorizar('NORMAL', ['ADMIN', 'NORMAL'])).toBe(true);
  });
});
