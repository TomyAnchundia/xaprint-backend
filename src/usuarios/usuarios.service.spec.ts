import { Test, TestingModule } from '@nestjs/testing';
import { UsuariosService } from './usuarios.service';
import { DatabaseService } from '../database/database.service';

describe('UsuariosService', () => {
  let service: UsuariosService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsuariosService, DatabaseService],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  it('debería encontrar un usuario por username', async () => {
    const usuario = await service.buscarPorUsername('tomy');

    expect(usuario).not.toBeNull();
    expect(usuario?.username).toBe('tomy');
  });

  it('debería verificar correctamente la contraseña', async () => {
    const usuario = await service.buscarPorUsername('tomy');

    expect(usuario).not.toBeNull();

    const passwordCorrecta = await service.verificarPassword(
      '123456',
      usuario!.password,
    );

    const passwordIncorrecta = await service.verificarPassword(
      'contraseña-incorrecta',
      usuario!.password,
    );

    expect(passwordCorrecta).toBe(true);
    expect(passwordIncorrecta).toBe(false);
  });
});
