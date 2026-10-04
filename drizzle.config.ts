import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env' });

const url = process.env.TURSO_CONNECTION_URL ?? process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url || !authToken) {
  throw new Error(
    'TURSO_CONNECTION_URL (o TURSO_DATABASE_URL) y TURSO_AUTH_TOKEN son obligatorios',
  );
}

export default defineConfig({
  schema: './src/database/schema/index.ts',
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url,
    authToken,
  },
});
