require('dotenv/config');

const Database = require('better-sqlite3');
const { drizzle } = require('drizzle-orm/better-sqlite3');
const { eq } = require('drizzle-orm');

const sqlite = new Database(process.env.DATABASE_URL);
const db = drizzle(sqlite);

const resultado = await db
  .select()
  .from(require('../dist/database/schema').usuarios)
  .where(eq(require('../dist/database/schema').usuarios.username, 'tomy'))
  .limit(1);

console.log(resultado);

sqlite.close();
