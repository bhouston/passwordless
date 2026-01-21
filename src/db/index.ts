import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';
import { getEnvConfig } from '@/server/env';
import * as schema from './schema';

const env = getEnvConfig();
const sqlite = new Database(env.DATABASE_URL);

export const db: BetterSQLite3Database<typeof schema> = drizzle(sqlite, { schema });
