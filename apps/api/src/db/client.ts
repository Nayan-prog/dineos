import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';

export const DATABASE_URL = process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/dineos';
export const sql = postgres(DATABASE_URL, { max: 10 });
export const db = drizzle(sql, { schema });
export type DB = typeof db;
export { schema };
