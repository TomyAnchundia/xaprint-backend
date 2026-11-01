import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DURACION_REFERENCIA_MS = 5 * 24 * 60 * 60 * 1000;
const DURACION_URL_FIRMADA_SEGUNDOS = 5 * 60;
const INTERVALO_LIMPIEZA_MS = 60 * 60 * 1000;
const TAMANO_PAGINA = 1000;
const TAMANO_LOTE_BORRADO = 100;

export interface PedidoConReferencia {
  id: number;
  createdAt: Date | string;
  estado: string;
}

export interface ImagenReferenciaSubida {
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class PedidoReferenciaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PedidoReferenciaService.name);
  private readonly urlSupabase: string | undefined;
  private readonly claveServidor: string | undefined;
  private readonly bucket: string;
  private intervaloLimpieza: NodeJS.Timeout | undefined;
  private limpiezaEnCurso = false;

  constructor(config: ConfigService) {
    this.urlSupabase = config.get<string>('SUPABASE_URL')?.replace(/\/+$/, '');
    this.claveServidor = config.get<string>('SUPABASE_SERVICE_ROLE_KEY');
    this.bucket =
      config.get<string>('SUPABASE_REFERENCE_BUCKET') ?? 'pedido-referencias';
  }

  onModuleInit() {
    this.intervaloLimpieza = setInterval(() => {
      void this.limpiarReferenciasVencidas();
    }, INTERVALO_LIMPIEZA_MS);
    this.intervaloLimpieza.unref();
    void this.limpiarReferenciasVencidas();
  }

  onModuleDestroy() {
    if (this.intervaloLimpieza) {
      clearInterval(this.intervaloLimpieza);
    }
  }

  async subirReferencia(
    pedido: PedidoConReferencia,
    imagen: ImagenReferenciaSubida,
  ): Promise<{ venceEn: string }> {
    const venceEn = this.obtenerFechaVencimiento(pedido);
    if (
      venceEn.getTime() <= Date.now() ||
      pedido.estado === 'ENTREGADO' ||
      pedido.estado === 'CANCELADO'
    ) {
      throw new NotFoundException(
        'Este pedido ya no admite imágenes de referencia.',
      );
    }
    this.exigirConfiguracion();

    const ruta = this.obtenerRuta(pedido);
    const url = this.crearUrlStorage(
      `object/${encodeURIComponent(this.bucket)}/${encodeURIComponent(ruta)}`,
    );
    const respuesta = await this.llamarStorage(url, {
      method: 'POST',
      headers: {
        'Content-Type': imagen.mimetype,
        'Cache-Control': 'no-store',
        'x-upsert': 'true',
      },
      body: new Blob([new Uint8Array(imagen.buffer)]),
    });

    if (!respuesta.ok) {
      const detalle = await this.obtenerDetalleErrorStorage(respuesta);
      this.logger.error(
        `Supabase rechazó la carga de referencia para el pedido ${pedido.id} (HTTP ${respuesta.status})${detalle ? `: ${detalle}` : ''}.`,
      );
      throw new BadGatewayException(
        'No se pudo guardar la imagen de referencia.',
      );
    }

    return { venceEn: venceEn.toISOString() };
  }

  async obtenerUrlReferencia(
    pedido: PedidoConReferencia,
  ): Promise<{ url: string; venceEn: string }> {
    const venceEn = this.obtenerFechaVencimiento(pedido);
    if (
      venceEn.getTime() <= Date.now() ||
      pedido.estado === 'ENTREGADO' ||
      pedido.estado === 'CANCELADO'
    ) {
      throw new NotFoundException(
        'La imagen de referencia ya venció o no está disponible.',
      );
    }
    this.exigirConfiguracion();

    const segundosRestantes = Math.max(
      1,
      Math.floor((venceEn.getTime() - Date.now()) / 1000),
    );
    const respuesta = await this.llamarStorage(
      this.crearUrlStorage(
        `object/sign/${encodeURIComponent(this.bucket)}/${encodeURIComponent(this.obtenerRuta(pedido))}`,
      ),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expiresIn: Math.min(segundosRestantes, DURACION_URL_FIRMADA_SEGUNDOS),
        }),
      },
    );

    if (respuesta.status === 400 || respuesta.status === 404) {
      throw new NotFoundException(
        'Este pedido no tiene una imagen de referencia disponible.',
      );
    }
    if (!respuesta.ok) {
      this.logger.error(
        `Supabase no pudo firmar la referencia del pedido ${pedido.id} (HTTP ${respuesta.status}).`,
      );
      throw new BadGatewayException(
        'No se pudo cargar la imagen de referencia.',
      );
    }

    const datos: unknown = await respuesta.json();
    if (
      typeof datos !== 'object' ||
      datos === null ||
      !('signedURL' in datos) ||
      typeof datos.signedURL !== 'string'
    ) {
      this.logger.error(
        `Supabase devolvió una respuesta de URL firmada no válida para el pedido ${pedido.id}.`,
      );
      throw new BadGatewayException(
        'No se pudo cargar la imagen de referencia.',
      );
    }

    const urlFirmada = datos.signedURL.startsWith('http')
      ? datos.signedURL
      : `${this.urlSupabase}/storage/v1${datos.signedURL.startsWith('/') ? datos.signedURL : `/${datos.signedURL}`}`;

    return {
      url: urlFirmada,
      venceEn: venceEn.toISOString(),
    };
  }

  async eliminarReferencia(pedido: PedidoConReferencia): Promise<void> {
    if (!this.estaConfigurado()) return;

    try {
      const respuesta = await this.llamarStorage(
        this.crearUrlStorage(`object/${encodeURIComponent(this.bucket)}`),
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: [this.obtenerRuta(pedido)] }),
        },
      );
      if (respuesta.ok) return;
      this.logger.error(
        `No se pudo eliminar la referencia del pedido ${pedido.id} de Supabase (HTTP ${respuesta.status}).`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo eliminar la referencia del pedido ${pedido.id} de Supabase.`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async limpiarReferenciasVencidas(): Promise<void> {
    if (!this.estaConfigurado() || this.limpiezaEnCurso) return;

    this.limpiezaEnCurso = true;
    try {
      const vencidas: string[] = [];
      let offset = 0;
      while (true) {
        const respuesta = await this.llamarStorage(
          this.crearUrlStorage(
            `object/list/${encodeURIComponent(this.bucket)}`,
          ),
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prefix: '',
              limit: TAMANO_PAGINA,
              offset,
              sortBy: { column: 'name', order: 'asc' },
            }),
          },
        );
        if (!respuesta.ok) {
          throw new Error(
            `Supabase rechazó la consulta de referencias (HTTP ${respuesta.status}).`,
          );
        }

        const elementos: unknown = await respuesta.json();
        if (!Array.isArray(elementos)) {
          throw new Error('Supabase devolvió una lista de archivos no válida.');
        }

        const nombres = elementos.flatMap((elemento: unknown) => {
          if (
            typeof elemento !== 'object' ||
            elemento === null ||
            !('name' in elemento) ||
            typeof elemento.name !== 'string'
          ) {
            return [];
          }
          return [elemento.name];
        });

        const ahora = Date.now();
        for (const nombre of nombres) {
          const coincidencia = /^(\d+)-(\d+)$/.exec(nombre);
          if (!coincidencia) continue;

          const creadoEn = Number(coincidencia[2]);
          if (
            Number.isSafeInteger(creadoEn) &&
            creadoEn + DURACION_REFERENCIA_MS <= ahora
          ) {
            vencidas.push(nombre);
          }
        }

        offset += elementos.length;
        if (elementos.length < TAMANO_PAGINA) break;
      }

      for (
        let inicio = 0;
        inicio < vencidas.length;
        inicio += TAMANO_LOTE_BORRADO
      ) {
        const lote = vencidas.slice(inicio, inicio + TAMANO_LOTE_BORRADO);
        const respuesta = await this.llamarStorage(
          this.crearUrlStorage(`object/${encodeURIComponent(this.bucket)}`),
          {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prefixes: lote }),
          },
        );
        if (!respuesta.ok) {
          throw new Error(
            `Supabase no pudo borrar referencias vencidas (HTTP ${respuesta.status}).`,
          );
        }
      }

      if (vencidas.length > 0) {
        this.logger.log(`Se eliminaron ${vencidas.length} imágenes vencidas.`);
      }
    } catch (error) {
      this.logger.error(
        'No se pudieron limpiar las imágenes de referencia vencidas.',
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.limpiezaEnCurso = false;
    }
  }

  private obtenerFechaVencimiento(pedido: PedidoConReferencia): Date {
    const fechaCreacion =
      pedido.createdAt instanceof Date
        ? pedido.createdAt
        : new Date(pedido.createdAt);
    const marcaTiempo = fechaCreacion.getTime();
    if (!Number.isFinite(marcaTiempo)) {
      throw new BadGatewayException(
        'No se pudo determinar la fecha de creación del pedido.',
      );
    }
    return new Date(marcaTiempo + DURACION_REFERENCIA_MS);
  }

  private obtenerRuta(pedido: PedidoConReferencia): string {
    const fechaCreacion =
      pedido.createdAt instanceof Date
        ? pedido.createdAt
        : new Date(pedido.createdAt);
    const marcaTiempo = fechaCreacion.getTime();
    if (!Number.isSafeInteger(marcaTiempo)) {
      throw new BadGatewayException(
        'No se pudo determinar la fecha de creación del pedido.',
      );
    }
    return `${pedido.id}-${marcaTiempo}`;
  }

  private estaConfigurado(): boolean {
    return Boolean(this.urlSupabase && this.claveServidor);
  }

  private exigirConfiguracion(): void {
    if (!this.estaConfigurado()) {
      throw new ServiceUnavailableException(
        'La carga de imágenes de referencia no está configurada en el servidor.',
      );
    }
  }

  private crearUrlStorage(ruta: string): string {
    return `${this.urlSupabase}/storage/v1/${ruta}`;
  }

  private async obtenerDetalleErrorStorage(
    respuesta: Response,
  ): Promise<string | undefined> {
    let datos: unknown;
    try {
      datos = await respuesta.json();
    } catch {
      return undefined;
    }

    if (typeof datos !== 'object' || datos === null) return undefined;

    const campos = ['statusCode', 'error', 'message', 'code'];
    const detalles = campos.flatMap((campo) => {
      if (!(campo in datos)) return [];
      const valor = datos[campo];
      if (typeof valor !== 'string' && typeof valor !== 'number') return [];
      const texto = String(valor)
        .replace(/[\u0000-\u001f\u007f]/g, ' ')
        .trim();
      return texto ? [`${campo}=${texto.slice(0, 200)}`] : [];
    });

    return detalles.length ? detalles.join('; ') : undefined;
  }

  private llamarStorage(url: string, options: RequestInit): Promise<Response> {
    this.exigirConfiguracion();
    const claveServidor = this.claveServidor;
    if (!claveServidor) {
      throw new ServiceUnavailableException(
        'La carga de imágenes de referencia no está configurada en el servidor.',
      );
    }

    return fetch(url, {
      ...options,
      headers: {
        apikey: claveServidor,
        Authorization: `Bearer ${claveServidor}`,
        ...(options.headers ?? {}),
      },
    }).catch((error: unknown) => {
      this.logger.error(
        'No se pudo conectar con el almacenamiento de referencias.',
        error instanceof Error ? error.stack : undefined,
      );
      throw new BadGatewayException(
        'No se pudo conectar con el almacenamiento de imágenes.',
      );
    });
  }
}
