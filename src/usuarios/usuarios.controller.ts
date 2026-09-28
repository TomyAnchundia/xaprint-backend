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
import { JwtService } from '@nestjs/jwt';
import { UsuariosService } from './usuarios.service';
import { JwtAuthGuard } from '../auth/jwt-auth/jwt-auth.guard';
import { CrearUsuarioDto } from './dto/crear-usuario.dto';
import { ActualizarUsuarioDto } from './dto/actualizar-usuario.dto';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  // LOGIN — público
  @Post('login')
  async login(
    @Body('username') username: string,
    @Body('password') password: string,
  ) {
    const usuario = await this.usuariosService.buscarPorUsername(username);

    if (!usuario) {
      return {
        success: false,
        message: 'Usuario o contraseña incorrectos',
      };
    }

    const passwordValida = await this.usuariosService.verificarPassword(
      password,
      usuario.password,
    );

    if (!passwordValida) {
      return {
        success: false,
        message: 'Usuario o contraseña incorrectos',
      };
    }

    const token = this.jwtService.sign({
      sub: usuario.id,
      username: usuario.username,
      rol: usuario.rol,
      area: usuario.area,
    });

    return {
      success: true,
      message: 'Credenciales correctas',
      token,
      usuario: {
        id: usuario.id,
        username: usuario.username,
        rol: usuario.rol,
        area: usuario.area,
      },
    };
  }

  // PERFIL — protegido
  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  perfil() {
    return {
      success: true,
      message: 'Ruta protegida funcionando',
    };
  }

  // LISTAR
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerTodos() {
    return this.usuariosService.obtenerTodos();
  }

  // OBTENER UNO
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  obtenerPorId(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerPorId(id);
  }

  // CREAR
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  crear(@Body() datos: CrearUsuarioDto) {
    return this.usuariosService.crear(datos);
  }

  // ACTUALIZAR
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarUsuarioDto,
  ) {
    return this.usuariosService.actualizar(id, datos);
  }

  // ELIMINAR
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.eliminar(id);
  }
}
