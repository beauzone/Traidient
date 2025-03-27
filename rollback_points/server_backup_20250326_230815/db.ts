import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../shared/schema';

// Check for environment variables
if (!process.env.DATABASE_URL) {
  throw new Error('Missing DATABASE_URL environment variable');
}

// Create a postgres client
const client = postgres(process.env.DATABASE_URL);

// Create the database instance
export const db = drizzle(client, { schema });