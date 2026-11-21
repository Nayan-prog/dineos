import { defineConfig } from 'drizzle-kit';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// load the root .env (DATABASE_URL) — drizzle-kit does not do this by itself
const envFile = resolve(__dirname, '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: './src/db/schema.ts',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/dineos' },
});