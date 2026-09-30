import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { ActualizarPedidoDto } from './dto/actualizar-pedido.dto';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto';
import { CambiarPrecioEspecialDto } from './dto/cambiar-precio-especial.dto';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { EstadoPedido, PedidosService } from './pedidos.service';

interface RequestConUsuario extends Request {
  user: {
    id: number;
    username: string;
    rol: string;
    area: string | null;
  };
}

@Controller('pedidos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PedidosController {
  constructor(private readonly pedidosService: PedidosService) {}

  @Get()
  async obtenerTodos(@Req() request: RequestConUsuario) {
    const pedidos = await this.pedidosService.obtenerTodos();
    return pedidos.filter((pedido) => this.puedeAcceder(pedido, request.user));
  }

  @Get('historial')
  async obtenerHistorialGeneral(@Req() request: RequestConUsuario) {
    const historial = await this.pedidosService.obtenerHistorialGeneral();
    return historial.filter((item) => this.puedeAcceder(item, request.user));
  }

  @Get(':id')
  async obtenerPorId(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestConUsuario,
  ) {
    const pedido = await this.pedidosService.buscarPorId(id);

    if (!pedido || !this.puedeAcceder(pedido, request.user)) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return pedido;
  }

  @Get(':id/historial')
  async obtenerHistorial(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestConUsuario,
  ) {
    const pedido = await this.pedidosService.buscarPorId(id);
    if (!pedido || !this.puedeAcceder(pedido, request.user)) {
      throw new NotFoundException('Pedido no encontrado');
    }

    return this.pedidosService.obtenerHistorial(id);
  }

  @Post()
  async crear(
    @Body() datos: CrearPedidoDto,
    @Req() request: RequestConUsuario,
  ) {
    this.exigirAccesoArea(datos, request.user);
    return this.pedidosService.crear(datos);
  }

  @Patch(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarPedidoDto,
    @Req() request: RequestConUsuario,
  ) {
    const pedido = await this.obtenerPedidoPermitido(id, request.user);
    this.exigirAccesoArea(
      {
        servicio: datos.servicio ?? pedido.servicio,
        ancho: datos.ancho ?? pedido.ancho,
      },
      request.user,
    );
    return this.pedidosService.actualizar(id, datos);
  }

  @Patch(':id/estado')
  async cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CambiarEstadoPedidoDto,
    @Req() request: RequestConUsuario,
  ) {
    await this.obtenerPedidoPermitido(id, request.user);
    return this.pedidosService.cambiarEstado(
      id,
      datos.estado as EstadoPedido,
      request.user.id,
    );
  }

  @Delete(':id')
  @Roles('ADMIN')
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestConUsuario,
  ) {
    await this.obtenerPedidoPermitido(id, request.user);
    return this.pedidosService.eliminar(id);
  }

  @Patch(':id/precio-especial')
  async cambiarPrecioEspecial(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CambiarPrecioEspecialDto,
    @Req() request: RequestConUsuario,
  ) {
    await this.obtenerPedidoPermitido(id, request.user);
    return this.pedidosService.cambiarPrecioEspecial(
      id,
      datos.precioEspecial,
      request.user.id,
    );
  }

  private async obtenerPedidoPermitido(
    id: number,
    usuario: RequestConUsuario['user'],
  ) {
    const pedido = await this.pedidosService.buscarPorId(id);
    if (!pedido || !this.puedeAcceder(pedido, usuario)) {
      throw new NotFoundException('Pedido no encontrado');
    }
    return pedido;
  }

  private exigirAccesoArea(
    pedido: { servicio: string; ancho: number },
    usuario: RequestConUsuario['user'],
  ) {
    if (!this.puedeAcceder(pedido, usuario)) {
      throw new ForbiddenException('No tienes acceso al área de este pedido');
    }
  }

  private puedeAcceder(
    pedido: { servicio: string; ancho: number },
    usuario: RequestConUsuario['user'],
  ) {
    if (usuario.rol !== 'EMPLEADO') return true;
    if (!usuario.area) return false;
    if (usuario.area === 'UV') return pedido.servicio === 'UV';

    return (
      pedido.servicio === 'TEXTIL' &&
      pedido.ancho === (usuario.area === 'TEXTIL31' ? 31 : 58)
    );
  }
}
