import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { ActualizarProductoDto } from './dto/actualizar-producto.dto';
import { ActualizarCategoriaDto } from './dto/actualizar-categoria.dto';
import { ActualizarUsuarioInventarioDto } from './dto/actualizar-usuario-inventario.dto';
import { CrearClienteDto } from '../clientes/dto/crear-cliente.dto';
import { ActualizarClienteDto } from '../clientes/dto/actualizar-cliente.dto';
import { CrearProductoDto } from './dto/crear-producto.dto';
import { CrearCategoriaDto } from './dto/crear-categoria.dto';
import { CrearUsuarioInventarioDto } from './dto/crear-usuario-inventario.dto';
import { CrearVentaDto } from './dto/crear-venta.dto';
import { LoginInventarioDto } from './dto/login-inventario.dto';
import { RegistrarMovimientoDto } from './dto/registrar-movimiento.dto';
import { InventarioAuthGuard } from './inventario-auth.guard';
import { InventarioService } from './inventario.service';

interface RequestConUsuarioInventario extends Request {
  user: {
    id: number;
    username: string;
    rol: 'ADMIN' | 'NORMAL';
  };
}

@Controller('inventario')
export class InventarioController {
  constructor(
    private readonly inventarioService: InventarioService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('auth/login')
  async login(@Body() datos: LoginInventarioDto) {
    const usuario = await this.inventarioService.validarCredenciales(
      datos.username,
      datos.password,
    );
    if (!usuario) {
      return {
        success: false,
        message: 'Usuario o contraseña incorrectos',
      };
    }

    const token = this.jwtService.sign({
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      sistema: 'INVENTARIO',
    });
    return { success: true, token, usuario };
  }

  @Get('auth/perfil')
  @UseGuards(InventarioAuthGuard)
  perfil(@Req() request: RequestConUsuarioInventario) {
    return { success: true, usuario: request.user };
  }

  @Get('categorias')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerCategorias() {
    return this.inventarioService.obtenerCategorias();
  }

  @Post('categorias')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  crearCategoria(@Body() datos: CrearCategoriaDto) {
    return this.inventarioService.crearCategoria(datos);
  }

  @Patch('categorias/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  actualizarCategoria(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarCategoriaDto,
  ) {
    return this.inventarioService.actualizarCategoria(id, datos);
  }

  @Delete('categorias/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminarCategoria(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.eliminarCategoria(id);
  }

  @Get('clientes')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  obtenerClientes() {
    return this.inventarioService.obtenerClientes();
  }

  @Post('clientes')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  crearCliente(@Body() datos: CrearClienteDto) {
    return this.inventarioService.crearCliente(datos);
  }

  @Patch('clientes/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  actualizarCliente(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarClienteDto,
  ) {
    return this.inventarioService.actualizarCliente(id, datos);
  }

  @Delete('clientes/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminarCliente(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.eliminarCliente(id);
  }

  @Get('productos/venta')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  obtenerProductosParaVenta() {
    return this.inventarioService.obtenerProductosParaVenta();
  }

  @Get('productos')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerProductos() {
    return this.inventarioService.obtenerProductos();
  }

  @Post('productos')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  crearProducto(
    @Body() datos: CrearProductoDto,
    @Req() request: RequestConUsuarioInventario,
  ) {
    return this.inventarioService.crearProducto(datos, request.user);
  }

  @Patch('productos/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  actualizarProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarProductoDto,
    @Req() request: RequestConUsuarioInventario,
  ) {
    return this.inventarioService.actualizarProducto(id, datos, request.user);
  }

  @Delete('productos/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminarProducto(@Param('id', ParseIntPipe) id: number) {
    return this.inventarioService.eliminarProducto(id);
  }

  @Post('movimientos')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  registrarMovimiento(
    @Body() datos: RegistrarMovimientoDto,
    @Req() request: RequestConUsuarioInventario,
  ) {
    return this.inventarioService.registrarMovimiento(datos, request.user);
  }

  @Get('movimientos')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerMovimientos() {
    return this.inventarioService.obtenerMovimientos();
  }

  @Get('ventas/estadisticas')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerEstadisticas(
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    return this.inventarioService.obtenerEstadisticas(desde, hasta);
  }

  @Get('ventas')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  obtenerVentas() {
    return this.inventarioService.obtenerVentas();
  }

  @Post('ventas')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  crearVenta(
    @Body() datos: CrearVentaDto,
    @Req() request: RequestConUsuarioInventario,
  ) {
    return this.inventarioService.crearVenta(datos, request.user);
  }

  @Patch('ventas/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  actualizarVenta(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: CrearVentaDto,
    @Req() request: RequestConUsuarioInventario,
  ) {
    return this.inventarioService.actualizarVenta(id, datos, request.user);
  }

  @Get('resumen')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN', 'NORMAL')
  obtenerResumen(@Req() request: RequestConUsuarioInventario) {
    return this.inventarioService.obtenerResumen(request.user.rol === 'ADMIN');
  }

  @Get('usuarios')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerUsuarios() {
    return this.inventarioService.obtenerUsuarios();
  }

  @Post('usuarios')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  crearUsuario(@Body() datos: CrearUsuarioInventarioDto) {
    return this.inventarioService.crearUsuario(datos);
  }

  @Patch('usuarios/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  actualizarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarUsuarioInventarioDto,
  ) {
    return this.inventarioService.actualizarUsuario(id, datos);
  }

  @Delete('usuarios/:id')
  @UseGuards(InventarioAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Req() request: RequestConUsuarioInventario,
  ) {
    return this.inventarioService.eliminarUsuario(id, request.user.id);
  }

  @Post('usuarios/bootstrap')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  crearPrimerAdministrador(@Body() datos: CrearUsuarioInventarioDto) {
    return this.inventarioService.crearPrimerAdministrador(datos);
  }
}
