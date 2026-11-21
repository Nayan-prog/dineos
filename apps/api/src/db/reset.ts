import { sql } from './client.js';

await sql.unsafe('drop schema public cascade; create schema public;');
console.log('database cleared');
await sql.end();
