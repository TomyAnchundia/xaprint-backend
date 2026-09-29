import 'dotenv/config';

import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  });
  readonly db = drizzle({ client: this.client });

  async onModuleInit() {
    const result = await this.client.execute('SELECT 1 as ok');

    console.log('Turso conectado:', result.rows);
  }
}
