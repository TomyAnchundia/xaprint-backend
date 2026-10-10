import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';

import { Request as ExpressRequest } from 'express';

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { PedidosGateway } from '../pedidos/pedidos.gateway';

import { CrearPagoDesarrolladorDto } from './dto/crear-pago-desarrollador.dto';
import { CrearPagoDto } from './dto/crear-pago-dto';
import { CrearPagoPedidoDto } from './dto/crear-pago-pedido.dto';
import { PagosService } from './pagos.service';

interface RequestConUsuario extends ExpressRequest {
  user: {
    id: number;
    username: string;
    rol: string;
    area: string;
  };
}

@Controller('pagos')
@UseGuards(JwtAuthGuard)
export class PagosController {
  constructor(
    private readonly pagosService: PagosService,
    private readonly pedidosGateway: PedidosGateway,
  ) {}

  @Get('deuda/:clienteId')
  obtenerDeudaCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.pagosService.obtenerDeudaCliente(clienteId);
  }

  @Get('pedido/:pedidoId')
  obtenerPagosPedido(@Param('pedidoId', ParseIntPipe) pedidoId: number) {
    return this.pagosService.obtenerPagosPedido(pedidoId);
  }

  @Get('resumen')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  obtenerResumen(@Query('fecha') fecha: string) {
    return this.pagosService.obtenerResumen(fecha);
  }

  @Get('resumen-periodo')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  obtenerResumenPeriodo(
    @Query('desde') desde: string,
    @Query('hasta') hasta: string,
  ) {
    return this.pagosService.obtenerResumenPeriodo(desde, hasta);
  }

  @Get('desarrollador')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  obtenerResumenDesarrollador(@Query('periodo') periodo: string) {
    return this.pagosService.obtenerResumenDesarrollador(periodo);
  }

  @Post('desarrollador')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  async registrarPagoDesarrollador(
    @Body() dto: CrearPagoDesarrolladorDto,
    @Request() req: RequestConUsuario,
  ) {
    const resultado = await this.pagosService.registrarPagoDesarrollador(
      req.user.id,
      dto,
    );
    this.pedidosGateway.emitirFinanzasActualizadas();
    return resultado;
  }

  @Get('deudas')
  obtenerDeudasClientes() {
    return this.pagosService.obtenerDeudasClientes();
  }

  @Get('cliente/:clienteId')
  obtenerPagosCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.pagosService.obtenerPagosCliente(clienteId);
  }

  @Post('pedido/:pedidoId')
  async registrarPagoPedido(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
    @Body() dto: CrearPagoPedidoDto | undefined,
    @Request() req: RequestConUsuario,
  ) {
    const resultado = await this.pagosService.registrarPagoPedido(
      req.user.id,
      pedidoId,
      dto?.metodoPago,
    );
    this.pedidosGateway.emitirFinanzasActualizadas();
    return resultado;
  }

  @Delete('pedido/:pedidoId/ultimo')
  async revertirUltimoPagoPedido(
    @Param('pedidoId', ParseIntPipe) pedidoId: number,
    @Request() req: RequestConUsuario,
  ) {
    const resultado = await this.pagosService.revertirUltimoPagoPedido(
      req.user.id,
      pedidoId,
    );
    this.pedidosGateway.emitirFinanzasActualizadas();
    return resultado;
  }

  @Post()
  async registrarPago(
    @Body() dto: CrearPagoDto,
    @Request() req: RequestConUsuario,
  ) {
    const resultado = await this.pagosService.registrarPago(req.user.id, dto);
    this.pedidosGateway.emitirFinanzasActualizadas();
    return resultado;
  }
}
