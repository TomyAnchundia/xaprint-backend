import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class InventarioAuthGuard extends AuthGuard('jwt-inventario') {}
