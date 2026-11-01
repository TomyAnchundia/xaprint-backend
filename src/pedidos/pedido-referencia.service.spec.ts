import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { PedidoReferenciaService } from './pedido-referencia.service';

describe('PedidoReferenciaService', () => {
  let service: PedidoReferenciaService;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  let ultimaUrl: string | undefined;
  let ultimaSolicitud: RequestInit | undefined;
  let respuestaFetch: Response;
  const supabaseUrl = 'https://referencias.supabase.co';
  const serviceKey = 'server-only-key';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidoReferenciaService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({
                SUPABASE_URL: supabaseUrl,
                SUPABASE_SERVICE_ROLE_KEY: serviceKey,
                SUPABASE_REFERENCE_BUCKET: 'pedido-referencias',
              })[key],
          },
        },
      ],
    }).compile();

    service = module.get<PedidoReferenciaService>(PedidoReferenciaService);
    ultimaUrl = undefined;
    ultimaSolicitud = undefined;
    respuestaFetch = new Response(null, { status: 200 });
    fetchMock = jest
      .spyOn(global, 'fetch')
      .mockImplementation((_input, options) => {
        ultimaUrl =
          typeof _input === 'string'
            ? _input
            : _input instanceof URL
              ? _input.href
              : _input.url;
        ultimaSolicitud = options;
        return Promise.resolve(respuestaFetch);
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sube la imagen al bucket privado sin alterar el pedido', async () => {
    const pedido = {
      id: 42,
      estado: 'REVISION',
      createdAt: new Date('2026-10-31T12:00:00.000Z'),
    };

    const resultado = await service.subirReferencia(pedido, {
      mimetype: 'image/png',
      buffer: Buffer.from('imagen'),
      size: 6,
    });

    expect(resultado.venceEn).toBe('2026-11-05T12:00:00.000Z');
    expect(ultimaUrl).toBe(
      `${supabaseUrl}/storage/v1/object/pedido-referencias/42-${pedido.createdAt.getTime()}`,
    );
    const headers = new Headers(ultimaSolicitud?.headers);
    expect(ultimaSolicitud?.method).toBe('POST');
    expect(headers.get('apikey')).toBe(serviceKey);
    expect(headers.get('Authorization')).toBe(`Bearer ${serviceKey}`);
    expect(headers.get('x-upsert')).toBe('true');
  });

  it('emite enlaces privados de corta duración', async () => {
    respuestaFetch = new Response(
      JSON.stringify({
        signedURL:
          '/object/sign/pedido-referencias/42-1793448000000?token=test',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
    const pedido = {
      id: 42,
      estado: 'REVISION',
      createdAt: new Date(Date.now() - 60_000),
    };

    const resultado = await service.obtenerUrlReferencia(pedido);

    expect(resultado.url).toContain(
      `${supabaseUrl}/storage/v1/object/sign/pedido-referencias/42-`,
    );
    expect(ultimaSolicitud?.body).toBe(JSON.stringify({ expiresIn: 300 }));
  });

  it('rechaza referencias que ya superaron cinco días', async () => {
    await expect(
      service.obtenerUrlReferencia({
        id: 42,
        estado: 'REVISION',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - 1),
      }),
    ).rejects.toMatchObject({ status: 404 });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registra el detalle estructurado del rechazo de Supabase', async () => {
    const registrarError = jest.spyOn(Logger.prototype, 'error');
    respuestaFetch = new Response(
      JSON.stringify({
        statusCode: '400',
        error: 'InvalidRequest',
        message: 'Bucket not found',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );

    await expect(
      service.subirReferencia(
        {
          id: 42,
          estado: 'REVISION',
          createdAt: new Date(),
        },
        {
          mimetype: 'image/png',
          buffer: Buffer.from('imagen'),
          size: 6,
        },
      ),
    ).rejects.toMatchObject({ status: 502 });

    expect(registrarError).toHaveBeenCalledWith(
      expect.stringContaining(
        'statusCode=400; error=InvalidRequest; message=Bucket not found',
      ),
    );
    expect(registrarError).not.toHaveBeenCalledWith(
      expect.stringContaining(serviceKey),
      expect.anything(),
    );
  });
});
