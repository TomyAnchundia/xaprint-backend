import 'dotenv/config';

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { and, eq } from 'drizzle-orm';

import { tarifas } from './schema';

const sqlite = new Database(process.env.DATABASE_URL!);
const db = drizzle(sqlite);

const tarifasIniciales = [
  // TEXTIL31
  {
    servicio: 'TEXTIL',
    ancho: 31,
    desde: 0,
    hasta: 200,
    precio: 6,
  },
  {
    servicio: 'TEXTIL',
    ancho: 31,
    desde: 200,
    hasta: 300,
    precio: 5.5,
  },
  {
    servicio: 'TEXTIL',
    ancho: 31,
    desde: 300,
    hasta: 700,
    precio: 5,
  },
  {
    servicio: 'TEXTIL',
    ancho: 31,
    desde: 700,
    hasta: null,
    precio: 4.5,
  },

  // TEXTIL58
  {
    servicio: 'TEXTIL',
    ancho: 58,
    desde: 0,
    hasta: 300,
    precio: 10,
  },
  {
    servicio: 'TEXTIL',
    ancho: 58,
    desde: 300,
    hasta: 700,
    precio: 8,
  },
  {
    servicio: 'TEXTIL',
    ancho: 58,
    desde: 700,
    hasta: 1000,
    precio: 7.5,
  },
  {
    servicio: 'TEXTIL',
    ancho: 58,
    desde: 1000,
    hasta: null,
    precio: 7,
  },

  // UV
  {
    servicio: 'UV',
    ancho: 29,
    desde: 0,
    hasta: 42,
    precio: 20,
  },
  {
    servicio: 'UV',
    ancho: 29,
    desde: 42,
    hasta: 50,
    precio: 19,
  },
  {
    servicio: 'UV',
    ancho: 29,
    desde: 50,
    hasta: 100,
    precio: 18,
  },
  {
    servicio: 'UV',
    ancho: 29,
    desde: 100,
    hasta: 200,
    precio: 15,
  },
  {
    servicio: 'UV',
    ancho: 29,
    desde: 200,
    hasta: null,
    precio: 14.5,
  },
];

async function main() {
  for (const tarifa of tarifasIniciales) {
    const existente = await db
      .select()
      .from(tarifas)
      .where(
        and(
          eq(tarifas.servicio, tarifa.servicio),
          eq(tarifas.ancho, tarifa.ancho),
          eq(tarifas.desde, tarifa.desde),
        ),
      );

    if (existente.length > 0) {
      console.log(
        `Ya existe: ${tarifa.servicio} ${tarifa.ancho}cm desde ${tarifa.desde}cm`,
      );
      continue;
    }

    await db.insert(tarifas).values(tarifa);

    console.log(
      `Creada: ${tarifa.servicio} ${tarifa.ancho}cm ${tarifa.desde}-${tarifa.hasta ?? '∞'} → $${tarifa.precio}/m`,
    );
  }

  console.log('Seed de tarifas finalizado.');
}

main()
  .catch((error) => {
    console.error('Error ejecutando seed:', error);
    process.exit(1);
  })
  .finally(() => {
    sqlite.close();
  });
