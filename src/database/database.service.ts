import 'dotenv/config';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

function leerConfiguracionBaseDatos() {
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

    console.log('Turso conectado:', result.rows);
  }
}
