import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CrearClienteDto } from './dto/crear-cliente.dto';
import { ActualizarClienteDto } from './dto/actualizar-cliente.dto';
import { ClientesService } from './clientes.service';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';

@Controller('clientes')
@UseGuards(JwtAuthGuard)
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  @Get()
  obtenerTodos() {
    return this.clientesService.obtenerTodos();
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.buscarPorId(id);
  }

  @Post()
  crear(@Body() datos: CrearClienteDto) {
    return this.clientesService.crear(datos);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarClienteDto,
  ) {
    return this.clientesService.actualizar(id, datos);
  }

  @Delete(':id')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.clientesService.eliminar(id);
  }
}
