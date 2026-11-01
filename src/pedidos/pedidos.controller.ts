import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Request } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

import { ActualizarPedidoDto } from './dto/actualizar-pedido.dto';
import { CambiarEstadoPedidoDto } from './dto/cambiar-estado-pedido.dto';
import { CambiarPrecioEspecialDto } from './dto/cambiar-precio-especial.dto';
import { CrearPedidoDto } from './dto/crear-pedido.dto';
import { PedidoReferenciaService } from './pedido-referencia.service';
import type { ImagenReferenciaSubida } from './pedido-referencia.service';
import { EstadoPedido, PedidosService } from './pedidos.service';

const TAMANO_MAXIMO_REFERENCIA = 5 * 1024 * 1024;
const TIPOS_IMAGEN_REFERENCIA = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

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
  constructor(
    private readonly pedidosService: PedidosService,
    private readonly pedidoReferenciaService: PedidoReferenciaService,
  ) {}

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

  @Get(':id/referencia')
  @Header('Cache-Control', 'private, no-store')
  async obtenerReferencia(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestConUsuario,
  ) {
    const pedido = await this.obtenerPedidoPermitido(id, request.user);
    return this.pedidoReferenciaService.obtenerUrlReferencia(pedido);
  }

  @Post(':id/referencia')
  @Roles('ADMIN', 'DISENADOR', 'DISEÑADOR')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: TAMANO_MAXIMO_REFERENCIA },
    }),
  )
  async subirReferencia(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile()
    archivo: ImagenReferenciaSubida | undefined,
    @Req() request: RequestConUsuario,
  ) {
    const pedido = await this.obtenerPedidoPermitido(id, request.user);
    if (!archivo) {
      throw new BadRequestException('Selecciona una imagen de referencia.');
    }
    this.validarImagenReferencia(archivo);
    return this.pedidoReferenciaService.subirReferencia(pedido, archivo);
  }

  @Post()
  @Roles('ADMIN', 'DISENADOR', 'DISEÑADOR')
  async crear(
    @Body() datos: CrearPedidoDto,
    @Req() request: RequestConUsuario,
  ) {
    this.exigirAccesoArea(datos, request.user);
    return this.pedidosService.crear(datos);
  }

  @Patch(':id')
  @Roles('ADMIN', 'DISENADOR', 'DISEÑADOR')
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
    if (datos.estado === 'CANCELADO' && request.user.rol === 'EMPLEADO') {
      throw new ForbiddenException('No tienes permiso para cancelar pedidos');
    }
    const pedidoActualizado = await this.pedidosService.cambiarEstado(
      id,
      datos.estado as EstadoPedido,
      request.user.id,
    );
    if (!pedidoActualizado) {
      throw new NotFoundException('Pedido no encontrado');
    }
    if (
      pedidoActualizado.estado === 'ENTREGADO' ||
      pedidoActualizado.estado === 'CANCELADO'
    ) {
      await this.pedidoReferenciaService.eliminarReferencia(pedidoActualizado);
    }
    return pedidoActualizado;
  }

  @Delete(':id')
  @Roles('ADMIN')
  async eliminar(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestConUsuario,
  ) {
    const pedido = await this.obtenerPedidoPermitido(id, request.user);
    const resultado = await this.pedidosService.eliminar(id);
    await this.pedidoReferenciaService.eliminarReferencia(pedido);
    return resultado;
  }

  @Patch(':id/precio-especial')
  @Roles('ADMIN', 'DISENADOR', 'DISEÑADOR')
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

  private validarImagenReferencia(
    archivo: ImagenReferenciaSubida,
  ): asserts archivo is ImagenReferenciaSubida {
    if (
      archivo.size > TAMANO_MAXIMO_REFERENCIA ||
      !TIPOS_IMAGEN_REFERENCIA.has(archivo.mimetype)
    ) {
      throw new BadRequestException(
        'La imagen debe ser JPG, PNG o WebP y no superar 5 MB.',
      );
    }

    const bytes = archivo.buffer;
    const esJpeg =
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff;
    const esPng =
      bytes.length >= 8 &&
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const esWebp =
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP';
    const tipoValido =
      (archivo.mimetype === 'image/jpeg' && esJpeg) ||
      (archivo.mimetype === 'image/png' && esPng) ||
      (archivo.mimetype === 'image/webp' && esWebp);

    if (!tipoValido) {
      throw new BadRequestException(
        'El contenido del archivo no coincide con una imagen JPG, PNG o WebP válida.',
      );
    }
  }
}
