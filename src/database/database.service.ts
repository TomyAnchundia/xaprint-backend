import 'dotenv/config';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

const LOCAL_DATABASE_URL = 'file:./local.db';

function leerConfiguracionBaseDatos() {
  const mode = process.env.DATABASE_MODE;
  if (mode === 'local') {
    return { url: LOCAL_DATABASE_URL };
  }
  if (mode && mode !== 'turso') {
    throw new Error('DATABASE_MODE debe ser "local" o "turso".');
  }

  const url =
    process.env.TURSO_DATABASE_URL ?? process.env.TURSO_CONNECTION_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) {
    throw new Error(
      'TURSO_DATABASE_URL (o TURSO_CONNECTION_URL) y TURSO_AUTH_TOKEN son obligatorios',
    );
  }
  return { url, authToken };
}

const databaseConfig = leerConfiguracionBaseDatos();

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly client = createClient(databaseConfig);
  readonly db = drizzle({ client: this.client });

  async onModuleInit() {
    const result = await this.client.execute('SELECT 1 as ok');

    console.log(
      process.env.DATABASE_MODE === 'local'
        ? 'Base de datos local conectada.'
        : 'Turso conectado:',
      result.rows,
    );
  }
}
