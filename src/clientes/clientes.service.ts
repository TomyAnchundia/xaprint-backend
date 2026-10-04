import { Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service';
import { clientes } from '../database/schema';
import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly database: DatabaseService) {}

  async obtenerTodos() {
    return this.database.db.select().from(clientes);
  }

  async buscarPorId(id: number) {
    const resultado = await this.database.db
      .select()
      .from(clientes)
      .where(eq(clientes.id, id))
      .limit(1);

    if (!resultado[0]) {
      throw new NotFoundException('Cliente no encontrado');
    }

    return resultado[0];
  }

  async crear(datos: CrearClienteDto) {
    const resultado = await this.database.db
      .insert(clientes)
      .values({
        nombre: datos.nombre,
        telefono: datos.telefono,
        cedula: datos.cedula ?? null,
        direccion: datos.direccion ?? null,
      })
      .returning();

    return resultado[0];
  }

  async actualizar(id: number, datos: ActualizarClienteDto) {
    await this.buscarPorId(id);

    const resultado = await this.database.db
      .update(clientes)
      .set(datos)
      .where(eq(clientes.id, id))
      .returning();

    return resultado[0];
  }

  async eliminar(id: number) {
    await this.buscarPorId(id);

    const resultado = await this.database.db
      .delete(clientes)
      .where(eq(clientes.id, id))
      .returning();

    return resultado[0];
  }
}
