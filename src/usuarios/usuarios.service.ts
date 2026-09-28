import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { usuarios } from '../database/schema';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';

@Injectable()
export class UsuariosService {
  constructor(private readonly database: DatabaseService) {}

  // Se usa internamente para el login.
  // Incluye la contraseña porque necesitamos verificarla.
  async buscarPorUsername(username: string) {
    const resultado = await this.database.db
      .select()
      .from(usuarios)
      .where(eq(usuarios.username, username))
      .limit(1);

    return resultado[0] ?? null;
  }

  async verificarPassword(password: string, hash: string) {
    return argon2.verify(hash, password);
  }

  // LISTAR USUARIOS
  async obtenerTodos() {
    return this.database.db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        rol: usuarios.rol,
        area: usuarios.area,
      })
      .from(usuarios);
  }

  // OBTENER USUARIO POR ID
  async obtenerPorId(id: number) {
    const resultado = await this.database.db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        rol: usuarios.rol,
        area: usuarios.area,
      })
      .from(usuarios)
      .where(eq(usuarios.id, id))
      .limit(1);

    if (!resultado[0]) {
      throw new NotFoundException('Usuario no encontrado');
    }

    return resultado[0];
  }

  // CREAR USUARIO
  async crear(datos: CrearUsuarioDto) {
    const passwordHash = await argon2.hash(datos.password);

    try {
      const resultado = await this.database.db
        .insert(usuarios)
        .values({
          username: datos.username,
          password: passwordHash,
          rol: datos.rol,
          area: datos.area,
        })
        .returning({
          id: usuarios.id,
          username: usuarios.username,
          rol: usuarios.rol,
          area: usuarios.area,
        });

      return resultado[0];
    } catch {
      throw new BadRequestException(
        'No se pudo crear el usuario. El username puede estar en uso.',
      );
    }
  }

  // ACTUALIZAR USUARIO
  async actualizar(id: number, datos: ActualizarUsuarioDto) {
    await this.obtenerPorId(id);

    const cambios: {
      username?: string;
      password?: string;
      rol?: string;
      area?: string;
    } = {};

    if (datos.username !== undefined) {
      cambios.username = datos.username;
    }

    if (datos.password !== undefined) {
      cambios.password = await argon2.hash(datos.password);
    }

    if (datos.rol !== undefined) {
      cambios.rol = datos.rol;
    }

    if (datos.area !== undefined) {
      cambios.area = datos.area;
    }

    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException(
        'No se proporcionaron cambios para actualizar',
      );
    }

    try {
      const resultado = await this.database.db
        .update(usuarios)
        .set(cambios)
        .where(eq(usuarios.id, id))
        .returning({
          id: usuarios.id,
          username: usuarios.username,
          rol: usuarios.rol,
          area: usuarios.area,
        });

      return resultado[0];
    } catch {
      throw new BadRequestException(
        'No se pudo actualizar el usuario. El username puede estar en uso.',
      );
    }
  }

  // ELIMINAR USUARIO
  async eliminar(id: number) {
    await this.obtenerPorId(id);

    const resultado = await this.database.db
      .delete(usuarios)
      .where(eq(usuarios.id, id))
      .returning({
        id: usuarios.id,
        username: usuarios.username,
        rol: usuarios.rol,
        area: usuarios.area,
      });

    return resultado[0];
  }
}
