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

    console.log('\nUsuario encontrado:', usuario);

    expect(usuario).not.toBeNull();
    expect(usuario?.username).toBe('tomy');
  });
});
