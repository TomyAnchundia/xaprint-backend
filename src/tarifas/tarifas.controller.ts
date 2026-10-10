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

import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { TarifasService, ServicioTarifa } from './tarifas.service';
import { ActivarTarifaEspecialDto } from './dto/activar-tarifa-especial.dto';
import { GuardarTarifaClienteDto } from './dto/guardar-tarifa-cliente.dto';

@Controller('tarifas')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class TarifasController {
  constructor(private readonly tarifasService: TarifasService) {}

  @Get()
  listar() {
    return this.tarifasService.listar();
  }

  @Get('clientes/:clienteId')
  listarDeCliente(@Param('clienteId', ParseIntPipe) clienteId: number) {
    return this.tarifasService.listarDeCliente(clienteId);
  }

  @Patch('clientes/:clienteId/especial')
  establecerClienteEspecial(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() body: ActivarTarifaEspecialDto,
  ) {
    return this.tarifasService.establecerClienteEspecial(
      clienteId,
      body.activo,
    );
  }

  @Post('clientes/:clienteId')
  crearParaCliente(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Body() body: GuardarTarifaClienteDto,
  ) {
    return this.tarifasService.crearParaCliente(clienteId, body);
  }

  @Patch('clientes/:clienteId/:tarifaId')
  actualizarParaCliente(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('tarifaId', ParseIntPipe) tarifaId: number,
    @Body() body: GuardarTarifaClienteDto,
  ) {
    return this.tarifasService.actualizarParaCliente(
      clienteId,
      tarifaId,
      body,
    );
  }

  @Delete('clientes/:clienteId/:tarifaId')
  eliminarParaCliente(
    @Param('clienteId', ParseIntPipe) clienteId: number,
    @Param('tarifaId', ParseIntPipe) tarifaId: number,
  ) {
    return this.tarifasService.eliminarParaCliente(clienteId, tarifaId);
  }

  @Get(':id')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.tarifasService.obtenerPorId(id);
  }

  @Post()
  crear(
    @Body()
    body: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    return this.tarifasService.crear(body);
  }

  @Patch(':id')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      servicio: ServicioTarifa;
      ancho: number;
      desde: number;
      hasta?: number | null;
      precio: number;
    },
  ) {
    return this.tarifasService.actualizar(id, body);
  }

  @Patch(':id/activo')
  cambiarActivo(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { activo: boolean },
  ) {
    return this.tarifasService.cambiarActivo(id, body.activo);
  }
}
